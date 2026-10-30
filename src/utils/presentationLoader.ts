import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MessageFlags } from 'discord.js';
import type { ExtractedButton, PresentationConfig, BirthdayAction } from '../types/index.js';

// Resolve o caminho do arquivo presentation.json na raiz do projeto
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PRESENTATION_FILE = path.resolve(__dirname, '../../presentation.json');

/**
 * Percorre recursivamente qualquer árvore de componentes Discord e extrai os botões
 */
export function extractButtonsFromComponents(components: unknown[] = []): ExtractedButton[] {
  const buttons: ExtractedButton[] = [];

  function traverse(list: unknown[]) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (item && typeof item === 'object') {
        const comp = item as Record<string, unknown>;
        // type 2 representa Button no Discord API ou tem custom_id
        if ((comp.type === 2 || comp.custom_id) && typeof comp.custom_id === 'string') {
          buttons.push({
            custom_id: comp.custom_id,
            label: typeof comp.label === 'string' ? comp.label : undefined,
            style: typeof comp.style === 'number' ? comp.style : undefined,
            emoji: comp.emoji as ExtractedButton['emoji']
          });
        }
        if (Array.isArray(comp.components)) {
          traverse(comp.components);
        }
      }
    }
  }

  traverse(components);
  return buttons;
}

/**
 * Carrega o presentation.json, extrai os IDs dos botões e prepara o payload
 */
export function loadPresentationConfig(): PresentationConfig {
  try {
    if (!fs.existsSync(PRESENTATION_FILE)) {
      throw new Error(`Arquivo presentation.json não encontrado em: ${PRESENTATION_FILE}`);
    }

    const rawData = fs.readFileSync(PRESENTATION_FILE, 'utf-8');
    const json = JSON.parse(rawData);

    const components = Array.isArray(json.components) ? json.components : [];
    const buttons = extractButtonsFromComponents(components);
    const buttonIds = buttons.map(b => b.custom_id);

    // Mapeamento dinâmico de IDs para ações
    const customActions = (json.button_actions || {}) as Record<string, string>;
    const actionMap = new Map<string, BirthdayAction>();

    for (const id of buttonIds) {
      if (customActions[id]) {
        actionMap.set(id, customActions[id]);
      } else if (id.toLowerCase().includes('view') || id.toLowerCase().includes('ver') || id.toLowerCase().includes('meu')) {
        actionMap.set(id, 'view');
      } else if (id.toLowerCase().includes('reg') || id.toLowerCase().includes('cadastr') || id.toLowerCase().includes('modal')) {
        actionMap.set(id, 'register');
      } else {
        const idx = buttonIds.indexOf(id);
        actionMap.set(id, idx === 0 ? 'register' : 'view');
      }
    }

    const flags = json.flags ? Number(json.flags) : MessageFlags.IsComponentsV2;

    return {
      success: true,
      raw: json,
      payload: {
        flags,
        components,
        content: typeof json.content === 'string' ? json.content : undefined
      },
      buttons,
      buttonIds,
      actionMap
    };
  } catch (error: any) {
    console.error('[presentationLoader] Erro ao carregar presentation.json:', error.message);
    return {
      success: false,
      error: error.message,
      payload: {
        flags: MessageFlags.IsComponentsV2,
        components: []
      },
      buttons: [],
      buttonIds: [],
      actionMap: new Map()
    };
  }
}

/**
 * Retorna a ação associada a um customId de botão
 */
export function getActionForButtonId(customId: string): BirthdayAction | null {
  const config = loadPresentationConfig();
  if (!config.success) return null;
  return config.actionMap.get(customId) || null;
}

