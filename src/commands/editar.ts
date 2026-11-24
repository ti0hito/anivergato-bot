import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { GuildConfig } from '../models/GuildConfig.js';
import { getEffectiveGuildImages } from '../utils/presentationLoader.js';
import { openEditImagesModal } from '../components/birthdayModal.js';

export const data = new SlashCommandBuilder()
  .setName('editar-painel')
  .setDescription('Configura e edita as imagens do painel e de parabéns deste servidor antes de enviar')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: 'Este comando só pode ser utilizado dentro de um servidor.',
      flags: [MessageFlags.Ephemeral]
    });
  }

  // Busca as imagens atuais deste servidor (ou padrões caso ainda não configurado)
  const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
  const { panelThumbnailUrl, panelBannerUrl, celebrationImageUrl } = getEffectiveGuildImages(guildConfig);

  // Abre diretamente o modal V2 de edição de imagens para este servidor
  await openEditImagesModal(
    interaction,
    panelThumbnailUrl,
    panelBannerUrl,
    celebrationImageUrl
  );
}
