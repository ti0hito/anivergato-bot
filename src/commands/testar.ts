import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { Birthday } from '../models/Birthday.js';
import { getLocalToday } from '../services/birthdayScheduler.js';
import { sendGuildBirthdaysNotification } from '../services/notificationService.js';
import { createSuccessContainer, createErrorContainer } from '../utils/containerFactory.js';
import { GuildConfig } from '../models/GuildConfig.js';

export const data = new SlashCommandBuilder()
  .setName('testar-notificacao')
  .setDescription('Dispara imediatamente a mensagem comemorativa de aniversário no canal de avisos')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(opt =>
    opt
      .setName('usuario')
      .setDescription('Membro para simular o teste (opcional, padrão: aniversariantes de hoje)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: 'Este comando só pode ser utilizado dentro de um servidor.',
      flags: [MessageFlags.Ephemeral]
    });
  }

  // Verifica se o canal de anúncios está configurado
  const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
  const targetChannelId = config?.announcementChannelId || interaction.guild.systemChannelId;

  if (!targetChannelId) {
    const errorContainer = createErrorContainer({
      title: 'Canal de Anúncios não configurado',
      message: 'Configure o canal de avisos com o comando `/config-canal` antes de testar.',
      hint: 'Exemplo: `/config-canal canal: #aniversarios`'
    });
    return interaction.reply({
      components: [errorContainer],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
    });
  }

  const { day, month, year } = getLocalToday();
  const targetUser = interaction.options.getUser('usuario');

  let userIdsToNotify: string[] = [];
  let isSimulation = false;

  if (targetUser) {
    // Simulação com o usuário especificado
    userIdsToNotify = [targetUser.id];
    isSimulation = true;
  } else {
    // Busca os aniversariantes cadastrados para hoje no servidor
    const todayBirthdays = await Birthday.find({
      guildId: interaction.guild.id,
      day,
      month
    });

    if (todayBirthdays.length > 0) {
      userIdsToNotify = todayBirthdays.map(b => b.userId);
    } else {
      // Se ninguém fizer aniversário hoje, usa o próprio autor do comando para simular o teste visual
      userIdsToNotify = [interaction.user.id];
      isSimulation = true;
    }
  }

  // Envia a mensagem no canal configurado com o GIF e layout V2
  const sentCount = await sendGuildBirthdaysNotification(
    interaction.client,
    interaction.guild.id,
    userIdsToNotify,
    year
  );

  const targetList = userIdsToNotify.map(id => `<@${id}>`).join(', ');

  const successContainer = createSuccessContainer({
    title: 'Notificação de Teste Enviada!',
    message: `A mensagem festiva com o GIF animado foi enviada com sucesso no canal <#${targetChannelId}>.`,
    details: [
      `• **Canal:** <#${targetChannelId}>`,
      `• **Membro(s) parabenizado(s):** ${targetList}`,
      isSimulation
        ? `• **Modo:** Simulação de teste (nenhum aniversário real hoje)`
        : `• **Modo:** Aniversariante(s) real(is) do dia (${day}/${month})`
    ]
  });

  return interaction.reply({
    components: [successContainer],
    flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
  });
}
