import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  MessageFlags
} from 'discord.js';
import { GuildConfig } from '../models/GuildConfig.js';
import { createSuccessContainer } from '../utils/containerFactory.js';

export const data = new SlashCommandBuilder()
  .setName('config-canal')
  .setDescription('Configura o canal de avisos e cargo mencionado nos aniversários')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(opt =>
    opt
      .setName('canal')
      .setDescription('Canal de texto onde as felicitações serão enviadas')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addRoleOption(opt =>
    opt
      .setName('cargo')
      .setDescription('Cargo opcional a ser mencionado na mensagem de aniversário')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: 'Este comando só pode ser utilizado dentro de um servidor.',
      flags: [MessageFlags.Ephemeral]
    });
  }

  const channel = interaction.options.getChannel('canal') as TextChannel;
  const role = interaction.options.getRole('cargo');

  await GuildConfig.findOneAndUpdate(
    { guildId: interaction.guild.id },
    {
      guildId: interaction.guild.id,
      announcementChannelId: channel.id,
      announcementRoleId: role ? role.id : null
    },
    { upsert: true }
  );

  const details = [`• **Canal de Avisos:** <#${channel.id}>`];
  if (role) {
    details.push(`• **Cargo a Mencionar:** <@&${role.id}>`);
  }

  const container = createSuccessContainer({
    title: 'Configuração atualizada com sucesso!',
    message: 'As mensagens comemorativas de aniversário serão enviadas conforme configurado:',
    details
  });

  return interaction.reply({
    components: [container],
    flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
  });
}

