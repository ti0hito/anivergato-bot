import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MessageFlags } from 'discord.js';
import type { ExtractedButton, PresentationConfig, BirthdayAction, IGuildConfig } from '../types/index.js';
import { DEFAULT_CELEBRATION_GIF } from './containerFactory.js';

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
 * Carrega o presentation.json, extrai os IDs dos botões e prepara o payload base
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
      } else if (id.toLowerCase().includes('edit')) {
        actionMap.set(id, 'edit');
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
 * Extrai a URL padrão do banner (type 12 MediaGallery) definida no presentation.json
 */
export function getDefaultPanelBannerUrl(): string {
  const base = loadPresentationConfig();
  if (!base.success) return '';

  for (const topComp of base.payload.components as any[]) {
    if (topComp?.type === 17 && Array.isArray(topComp.components)) {
      const gallery = topComp.components.find((c: any) => c?.type === 12);
      const url = gallery?.items?.[0]?.media?.url;
      if (typeof url === 'string') return url;
    }
  }
  return '';
}

/**
 * Resolve as URLs efetivas de um servidor (respeitando se o admin limpou o campo com "" ou se usa o padrão)
 */
export function getEffectiveGuildImages(guildConfig?: Partial<IGuildConfig> | null) {
  const defaultBanner = getDefaultPanelBannerUrl();

  const panelThumbnailUrl =
    guildConfig && typeof guildConfig.panelThumbnailUrl === 'string' && guildConfig.panelThumbnailUrl.trim().length > 0
      ? guildConfig.panelThumbnailUrl.trim()
      : null;

  const panelBannerUrl =
    guildConfig && typeof guildConfig.panelBannerUrl === 'string'
      ? guildConfig.panelBannerUrl.trim() || null
      : defaultBanner || null;

  const celebrationImageUrl =
    guildConfig && typeof guildConfig.celebrationImageUrl === 'string'
      ? guildConfig.celebrationImageUrl.trim() || null
      : DEFAULT_CELEBRATION_GIF;

  return {
    panelThumbnailUrl,
    panelBannerUrl,
    celebrationImageUrl
  };
}

/**
 * Monta o payload do painel de apresentação customizado para um servidor específico:
 * - Se panelThumbnailUrl estiver definido: converte o cabeçalho em Section (type 9) com Thumbnail (type 11).
 * - Se panelThumbnailUrl estiver vazio/null: mantém o cabeçalho como TextDisplay puro (type 10).
 * - Aplica ou remove o MediaGallery (type 12) do painel conforme panelBannerUrl do servidor.
 */
export function buildGuildPresentationPayload(guildConfig?: Partial<IGuildConfig> | null): PresentationConfig {
  const base = loadPresentationConfig();
  if (!base.success) return base;

  const clonedComponents = JSON.parse(JSON.stringify(base.payload.components)) as any[];
  const { panelThumbnailUrl, panelBannerUrl } = getEffectiveGuildImages(guildConfig);

  for (const topComp of clonedComponents) {
    if (topComp && topComp.type === 17 && Array.isArray(topComp.components)) {
      // 1. Cabeçalho do topo (primeiro componente de texto ou section)
      const firstIdx = topComp.components.findIndex((c: any) => c?.type === 10 || c?.type === 9);
      if (firstIdx !== -1) {
        const firstComp = topComp.components[firstIdx];
        const headerText =
          firstComp.type === 10
            ? firstComp.content
            : firstComp.components?.[0]?.content || '';

        if (panelThumbnailUrl) {
          // Com thumbnail: converte para Section (type 9) com Thumbnail accessory (type 11)
          topComp.components[firstIdx] = {
            type: 9,
            components: [
              {
                type: 10,
                content: headerText
              }
            ],
            accessory: {
              type: 11,
              media: {
                url: panelThumbnailUrl
              }
            }
          };
        } else {
          // Sem thumbnail: volta a ser um campo de texto comum (type 10)
          topComp.components[firstIdx] = {
            type: 10,
            content: headerText
          };
        }
      }

      // 2. Imagem / Banner principal do painel (type 12 MediaGallery)
      const galleryIdx = topComp.components.findIndex((c: any) => c?.type === 12);
      if (panelBannerUrl) {
        const galleryObj = {
          type: 12,
          items: [
            {
              media: {
                url: panelBannerUrl
              }
            }
          ]
        };

        if (galleryIdx !== -1) {
          topComp.components[galleryIdx] = galleryObj;
        } else {
          // Insere antes do último separador ou linha de botões
          const actionRowIdx = topComp.components.findIndex((c: any) => c?.type === 1);
          if (actionRowIdx !== -1) {
            topComp.components.splice(actionRowIdx, 0, galleryObj);
          } else {
            topComp.components.push(galleryObj);
          }
        }
      } else if (galleryIdx !== -1) {
        // Se o servidor deixou o banner vazio, remove o MediaGallery do painel daquele servidor
        topComp.components.splice(galleryIdx, 1);
      }
    }
  }

  return {
    ...base,
    payload: {
      ...base.payload,
      components: clonedComponents
    }
  };
}

/**
 * Retorna a ação associada a um customId de botão
 */
export function getActionForButtonId(customId: string): BirthdayAction | null {
  const config = loadPresentationConfig();
  if (!config.success) return null;
  return config.actionMap.get(customId) || null;
}
