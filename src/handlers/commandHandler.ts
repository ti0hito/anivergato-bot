import { REST, Routes } from 'discord.js';
import * as painelCommand from '../commands/painel.js';
import * as aniversarioCommand from '../commands/aniversario.js';
import * as configCommand from '../commands/config.js';
import * as testarCommand from '../commands/testar.js';

export const slashCommands = [
  painelCommand.data,
  aniversarioCommand.data,
  configCommand.data,
  testarCommand.data
];

/**
 * Registra os comandos Slash na API do Discord
 */
export async function registerSlashCommands(token: string, clientId: string) {
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    const body = slashCommands.map(c => c.toJSON());

    console.log(`📡 [SlashCommands] Registrando ${body.length} comandos na API do Discord...`);

    await rest.put(Routes.applicationCommands(clientId), {
      body
    });

    console.log('✅ [SlashCommands] Comandos Slash registrados com sucesso!');
  } catch (error: any) {
    console.error('❌ [SlashCommands] Falha ao registrar comandos:', error.message);
  }
}

