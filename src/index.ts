import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { connectDatabase } from './config/database.js';
import { registerSlashCommands } from './handlers/commandHandler.js';
import { handleInteraction } from './handlers/interactionHandler.js';
import { startBirthdayScheduler } from './services/birthdayScheduler.js';
import { loadPresentationConfig } from './utils/presentationLoader.js';

async function bootstrap() {
  console.log('🚀 [Bot] Inicializando AniverGato Bot (TypeScript)...');

  const token = process.env.TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error('❌ [Config] TOKEN ou DISCORD_CLIENT_ID ausentes no arquivo .env!');
    process.exit(1);
  }

  // 1. Conexão ao MongoDB Atlas
  await connectDatabase();

  // 2. Pré-carregamento do presentation.json para validação e extração de botões
  const presentation = loadPresentationConfig();
  if (presentation.success) {
    console.log(
      `📋 [Presentation] Layout carregado com sucesso. Botões detectados: [${presentation.buttonIds.join(', ')}]`
    );
  } else {
    console.warn(`⚠️ [Presentation] Aviso ao carregar presentation.json: ${presentation.error}`);
  }

  // 3. Inicialização do Discord Client
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`🤖 [Discord] Logado com sucesso como: ${readyClient.user.tag}`);

    // Registra os Slash Commands
    await registerSlashCommands(token, clientId);

    // Inicia o agendador de aniversários diário
    startBirthdayScheduler(readyClient);

    console.log('✨ [Bot] AniverGato Bot está 100% pronto e operacional!');
  });

  // 4. Escuta todas as interações (Slash commands, Botões dinâmicos e Modais)
  client.on(Events.InteractionCreate, async (interaction) => {
    await handleInteraction(interaction);
  });

  // 5. Login
  await client.login(token);

  // Tratamento de encerramento seguro
  const shutdown = async () => {
    console.log('\n🛑 Encerrando AniverGato Bot...');
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('❌ Falha fatal ao iniciar o bot:', err);
  process.exit(1);
});

