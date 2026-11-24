import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  SeparatorBuilder
} from 'discord.js';
import { buildGuildPresentationPayload } from '../utils/presentationLoader.js';
import { GuildConfig } from '../models/GuildConfig.js';
import { createSuccessContainer, createErrorContainer, createEditImagesButton } from '../utils/containerFactory.js';

export const data = new SlashCommandBuilder()
  .setName('painel-aniversario')
  .setDescription('Publica o painel de cadastro de aniversários do bot em um canal')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(option =>
    option
      .setName('canal')
      .setDescription('Canal onde o painel será enviado (padrão: canal atual)')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: 'Este comando só pode ser utilizado dentro de um servidor.',
      flags: [MessageFlags.Ephemeral]
    });
  }

  const targetChannel = (interaction.options.getChannel('canal') as TextChannel) || interaction.channel;

  if (!targetChannel || !(targetChannel instanceof TextChannel)) {
    const errorContainer = createErrorContainer({
      title: 'Canal inválido',
      message: 'Selecione um canal de texto válido para publicar o painel.'
    });
    return interaction.reply({
      components: [errorContainer],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
    });
  }

  // Busca as configurações visuais exclusivas deste servidor no banco
  const existingConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });

  // Constrói o painel aplicando as imagens e thumbnail (Section vs TextDisplay) deste servidor
  const presentation = buildGuildPresentationPayload(existingConfig);

  if (!presentation.success) {
    const errorContainer = createErrorContainer({
      title: 'Erro ao carregar presentation.json',
      message: presentation.error || 'Não foi possível ler o arquivo de apresentação.'
    });
    return interaction.reply({
      components: [errorContainer],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
    });
  }

  try {
    const sendOptions: any = {
      flags: presentation.payload.flags,
      components: presentation.payload.components as any
    };

    if (presentation.payload.content) {
      sendOptions.content = presentation.payload.content;
    }

    const sentMessage = await targetChannel.send(sendOptions);

    // Salva a referência da mensagem do painel no banco de dados deste servidor
    await GuildConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      {
        guildId: interaction.guild.id,
        panelChannelId: targetChannel.id,
        panelMessageId: sentMessage.id
      },
      { upsert: true }
    );

    const successContainer = createSuccessContainer({
      title: 'Painel publicado com sucesso!',
      message: `O painel de aniversários com Components V2 foi enviado em <#${targetChannel.id}>.`,
      details: [
        `• **Botões públicos no painel:** ${presentation.buttonIds.join(', ') || 'Nenhum'}`,
        `• Use o botão **✏️ Editar** abaixo (visível apenas para você) para alterar as imagens deste servidor!`
      ]
    });

    successContainer
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(createEditImagesButton('Editar'))
      );

    return interaction.reply({
      components: [successContainer],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
    });
  } catch (err: any) {
    console.error('Erro ao enviar painel de apresentação:', err);
    const errorContainer = createErrorContainer({
      title: 'Falha ao enviar mensagem',
      message: err.message
    });
    return interaction.reply({
      components: [errorContainer],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
    });
  }
}
