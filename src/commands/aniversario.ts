import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { Birthday } from '../models/Birthday.js';
import { getDaysUntilBirthday } from '../utils/dateUtils.js';
import {
  createBirthdayViewContainer,
  createSuccessContainer,
  createErrorContainer,
  createBirthdayListContainer
} from '../utils/containerFactory.js';

export const data = new SlashCommandBuilder()
  .setName('aniversario')
  .setDescription('Comandos para gerenciar seu aniversário no servidor')
  .addSubcommand(sub =>
    sub
      .setName('ver')
      .setDescription('Ver o aniversário cadastrado de um membro ou o seu próprio')
      .addUserOption(opt =>
        opt
          .setName('usuario')
          .setDescription('Membro cujo aniversário deseja visualizar (padrão: você)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('remover')
      .setDescription('Remove o seu aniversário registrado neste servidor')
  )
  .addSubcommand(sub =>
    sub
      .setName('listar')
      .setDescription('[Admin] Lista os aniversariantes do servidor por data')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: 'Este comando só pode ser utilizado dentro de um servidor.',
      flags: [MessageFlags.Ephemeral]
    });
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'ver') {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const isSelf = targetUser.id === interaction.user.id;

    const record = await Birthday.findOne({
      guildId: interaction.guild.id,
      userId: targetUser.id
    });

    if (!record) {
      const container = createErrorContainer({
        title: 'Aniversário não encontrado',
        message: isSelf
          ? 'Você ainda não registrou seu aniversário. Clique no botão do painel ou registre-se!'
          : `<@${targetUser.id}> ainda não registrou o aniversário no servidor.`
      });
      return interaction.reply({
        components: [container],
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
      });
    }

    const daysUntil = getDaysUntilBirthday(record.day, record.month);
    const container = createBirthdayViewContainer({
      user: targetUser,
      day: record.day,
      month: record.month,
      daysUntil,
      isSelf
    });

    return interaction.reply({
      components: [container],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
    });
  }

  if (subcommand === 'remover') {
    const deleted = await Birthday.findOneAndDelete({
      guildId: interaction.guild.id,
      userId: interaction.user.id
    });

    if (!deleted) {
      const container = createErrorContainer({
        title: 'Nenhum registro',
        message: 'Você não possuía nenhum aniversário cadastrado neste servidor.'
      });
      return interaction.reply({
        components: [container],
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
      });
    }

    const container = createSuccessContainer({
      title: 'Aniversário removido',
      message: 'Seu aniversário foi removido do servidor com sucesso. Você não receberá mais notificações.'
    });
    return interaction.reply({
      components: [container],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
    });
  }

  if (subcommand === 'listar') {
    // Apenas Administradores podem listar todos os aniversários do servidor
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      const container = createErrorContainer({
        title: 'Acesso Restrito',
        message: 'Apenas **Administradores** podem listar todos os aniversários cadastrados no servidor.'
      });
      return interaction.reply({
        components: [container],
        flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
      });
    }

    const list = await Birthday.find({ guildId: interaction.guild.id })
      .sort({ month: 1, day: 1 })
      .limit(25);

    const container = createBirthdayListContainer(
      `Aniversariantes de ${interaction.guild.name}`,
      list.map(b => ({ userId: b.userId, day: b.day, month: b.month }))
    );

    return interaction.reply({
      components: [container],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
    });
  }
}
