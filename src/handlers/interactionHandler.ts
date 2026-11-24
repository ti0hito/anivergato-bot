import {
  Interaction,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SeparatorBuilder
} from 'discord.js';
import {
  openBirthdayV2Modal,
  openEditImagesModal,
  getModalV2Value,
  MODAL_REGISTER_ID,
  INPUT_DAY_ID,
  SELECT_MONTH_ID,
  MODAL_EDIT_IMAGES_ID,
  INPUT_THUMBNAIL_ID,
  INPUT_PANEL_BANNER_ID,
  INPUT_CELEBRATION_IMG_ID
} from '../components/birthdayModal.js';
import {
  getActionForButtonId,
  getEffectiveGuildImages,
  buildGuildPresentationPayload
} from '../utils/presentationLoader.js';
import { Birthday } from '../models/Birthday.js';
import { GuildConfig } from '../models/GuildConfig.js';
import {
  isValidBirthday,
  formatBirthday,
  getDaysUntilBirthday,
  MONTH_NAMES,
  getMaxDaysInMonth
} from '../utils/dateUtils.js';
import {
  createSuccessContainer,
  createErrorContainer,
  createBirthdayViewContainer,
  createEditImagesButton,
  BTN_DELETE_SELF_ID,
  BTN_EDIT_IMAGES_ID
} from '../utils/containerFactory.js';

import * as painelCommand from '../commands/painel.js';
import * as editarCommand from '../commands/editar.js';
import * as aniversarioCommand from '../commands/aniversario.js';
import * as configCommand from '../commands/config.js';
import * as testarCommand from '../commands/testar.js';

export const BTN_PUBLISH_HERE_ID = 'btn_birthday_publish_here';

const commands = new Map<string, any>([
  [painelCommand.data.name, painelCommand],
  [editarCommand.data.name, editarCommand],
  [aniversarioCommand.data.name, aniversarioCommand],
  [configCommand.data.name, configCommand],
  [testarCommand.data.name, testarCommand]
]);

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function handleInteraction(interaction: Interaction) {
  try {
    // 1. Trata Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // 2. Trata Cliques em Botões
    if (interaction.isButton()) {
      // Botão especial: Remover o próprio cadastro a partir do card "Ver Meu Cadastro"
      if (interaction.customId === BTN_DELETE_SELF_ID) {
        if (!interaction.guild) return;

        await Birthday.findOneAndDelete({
          guildId: interaction.guild.id,
          userId: interaction.user.id
        });

        const successContainer = createSuccessContainer({
          title: 'Cadastro Removido com Sucesso!',
          message: 'Seu aniversário foi excluído deste servidor. Você não receberá mais notificações comemorativas.'
        });

        return interaction.update({
          components: [successContainer],
          flags: [MessageFlags.IsComponentsV2]
        });
      }

      // Botão especial: Publicar o painel já editado diretamente no canal atual
      if (interaction.customId === BTN_PUBLISH_HERE_ID) {
        if (!interaction.guild) return;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          const errorContainer = createErrorContainer({
            title: 'Acesso Restrito',
            message: 'Apenas **Administradores** podem publicar o painel.'
          });
          return interaction.reply({
            components: [errorContainer],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
          });
        }

        const targetChannel = interaction.channel;
        if (!targetChannel || !(targetChannel instanceof TextChannel)) {
          const errorContainer = createErrorContainer({
            title: 'Canal inválido',
            message: 'Use este botão em um canal de texto do servidor ou utilize `/painel-aniversario`.'
          });
          return interaction.reply({
            components: [errorContainer],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
          });
        }

        const existingConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        const presentation = buildGuildPresentationPayload(existingConfig);

        const sentMessage = await targetChannel.send({
          flags: presentation.payload.flags,
          components: presentation.payload.components as any
        });

        await GuildConfig.findOneAndUpdate(
          { guildId: interaction.guild.id },
          {
            guildId: interaction.guild.id,
            panelChannelId: targetChannel.id,
            panelMessageId: sentMessage.id
          },
          { upsert: true }
        );

        const publishedContainer = createSuccessContainer({
          title: 'Painel enviado com sucesso!',
          message: `O painel já personalizado para **${interaction.guild.name}** foi publicado em <#${targetChannel.id}>.`
        });

        return interaction.update({
          components: [publishedContainer],
          flags: [MessageFlags.IsComponentsV2]
        });
      }

      const action = getActionForButtonId(interaction.customId);

      // Botão "Editar" (exibido apenas em mensagens efêmeras para Administradores)
      if (interaction.customId === BTN_EDIT_IMAGES_ID || action === 'edit' || interaction.customId.includes('edit')) {
        if (!interaction.guild) {
          return interaction.reply({
            content: 'A edição só pode ser realizada dentro de um servidor.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          const errorContainer = createErrorContainer({
            title: 'Acesso Restrito',
            message: 'Apenas **Administradores** podem editar as imagens e o layout do painel deste servidor.'
          });
          return interaction.reply({
            components: [errorContainer],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
          });
        }

        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        const { panelThumbnailUrl, panelBannerUrl, celebrationImageUrl } = getEffectiveGuildImages(guildConfig);

        await openEditImagesModal(
          interaction,
          panelThumbnailUrl,
          panelBannerUrl,
          celebrationImageUrl
        );
        return;
      }

      // Botão "Cadastrar Aniversário": Abre o Modal V2 com Dropdown de Mês e Input de Dia
      if (action === 'register' || interaction.customId.includes('register') || interaction.customId.includes('cadastr')) {
        if (!interaction.guild) {
          return interaction.reply({
            content: 'O cadastro só pode ser realizado dentro de um servidor.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const existing = await Birthday.findOne({
          guildId: interaction.guild.id,
          userId: interaction.user.id
        });

        await openBirthdayV2Modal(interaction, existing?.day, existing?.month);
        return;
      }

      // Botão "Ver Meu Cadastro"
      if (action === 'view' || interaction.customId.includes('view') || interaction.customId.includes('meu')) {
        if (!interaction.guild) {
          return interaction.reply({
            content: 'Apenas dentro de um servidor.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

        if (interaction.message && !interaction.message.flags.has(MessageFlags.Ephemeral)) {
          await GuildConfig.findOneAndUpdate(
            { guildId: interaction.guild.id },
            {
              guildId: interaction.guild.id,
              panelChannelId: interaction.channelId,
              panelMessageId: interaction.message.id
            },
            { upsert: true }
          );
        }

        const record = await Birthday.findOne({
          guildId: interaction.guild.id,
          userId: interaction.user.id
        });

        if (!record) {
          const errorContainer = createErrorContainer({
            title: 'Nenhum aniversário cadastrado',
            message: 'Você ainda não registrou o seu aniversário neste servidor.',
            hint: 'Clique no botão "Cadastrar Aniversário" para cadastrar agora mesmo!'
          });

          if (isAdmin) {
            errorContainer
              .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
              .addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(createEditImagesButton('Editar'))
              );
          }

          return interaction.reply({
            components: [errorContainer],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
          });
        }

        const daysUntil = getDaysUntilBirthday(record.day, record.month);
        const viewContainer = createBirthdayViewContainer({
          user: interaction.user,
          day: record.day,
          month: record.month,
          daysUntil,
          isSelf: true,
          isAdmin
        });

        return interaction.reply({
          components: [viewContainer],
          flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
        });
      }
    }

    // 3. Trata Envio dos Modais V2
    if (interaction.isModalSubmit()) {
      // 3A. Submissão do Modal de Edição de Imagens do Servidor
      if (interaction.customId === MODAL_EDIT_IMAGES_ID) {
        if (!interaction.guild) return;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          const errorContainer = createErrorContainer({
            title: 'Acesso Restrito',
            message: 'Apenas **Administradores** podem editar as imagens deste servidor.'
          });
          return interaction.reply({
            components: [errorContainer],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
          });
        }

        const thumbRaw = (getModalV2Value(INPUT_THUMBNAIL_ID, interaction) ?? '').trim();
        const bannerRaw = (getModalV2Value(INPUT_PANEL_BANNER_ID, interaction) ?? '').trim();
        const celebrationRaw = (getModalV2Value(INPUT_CELEBRATION_IMG_ID, interaction) ?? '').trim();

        const urlChecks: Array<{ label: string; value: string }> = [
          { label: 'Thumbnail do Topo', value: thumbRaw },
          { label: 'Banner do Painel', value: bannerRaw },
          { label: 'GIF / Imagem de Parabéns', value: celebrationRaw }
        ];

        for (const check of urlChecks) {
          if (check.value.length > 0 && !isValidHttpUrl(check.value)) {
            const errorContainer = createErrorContainer({
              title: 'URL Inválida!',
              message: `O link informado em **${check.label}** (\`${check.value}\`) não é uma URL HTTP/HTTPS válida.`,
              hint: 'Certifique-se de colar um link completo começando com https:// ou deixe o campo completamente vazio para remover a imagem.'
            });
            return interaction.reply({
              components: [errorContainer],
              flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
            });
          }
        }

        // Salva no MongoDB isoladamente para este servidor (guildId)
        const updatedConfig = await GuildConfig.findOneAndUpdate(
          { guildId: interaction.guild.id },
          {
            $set: {
              guildId: interaction.guild.id,
              panelThumbnailUrl: thumbRaw,
              panelBannerUrl: bannerRaw,
              celebrationImageUrl: celebrationRaw
            }
          },
          { upsert: true, returnDocument: 'after' }
        );

        // Se já houver um painel ativo no servidor, atualiza-o ao vivo
        let panelUpdatedLive = false;
        const updatedPresentation = buildGuildPresentationPayload(updatedConfig);

        if (updatedPresentation.success && updatedConfig?.panelChannelId && updatedConfig?.panelMessageId) {
          try {
            const ch = await interaction.guild.channels.fetch(updatedConfig.panelChannelId).catch(() => null);
            if (ch && ch instanceof TextChannel) {
              const msg = await ch.messages.fetch(updatedConfig.panelMessageId).catch(() => null);
              if (msg) {
                await msg.edit({
                  flags: updatedPresentation.payload.flags,
                  components: updatedPresentation.payload.components as any
                });
                panelUpdatedLive = true;
              }
            }
          } catch (e) {
            console.warn('[EditImages] Não foi possível editar a mensagem anterior do painel:', e);
          }
        }

        const successContainer = createSuccessContainer({
          title: 'Imagens do Servidor Salvas!',
          message: `As configurações visuais de **${interaction.guild.name}** foram salvas separadamente sem afetar nenhum outro servidor.`,
          details: [
            `• **Thumbnail do Topo:** ${thumbRaw ? `Ativada como Section (\`Thumbnail\`)` : `Desativada (Texto Comum limpo)`}`,
            `• **Banner do Painel:** ${bannerRaw ? `[Link configurado](${bannerRaw})` : `Removido (Sem banner)`}`,
            `• **GIF/Imagem de Parabéns:** ${celebrationRaw ? `[Link configurado](${celebrationRaw})` : `Removido (Sem imagem)`}`,
            panelUpdatedLive
              ? `• ✨ **O painel já publicado no servidor foi atualizado automaticamente!**`
              : `• 📤 **Pronto para enviar!** Clique em **Enviar Painel Neste Canal** abaixo ou use \`/painel-aniversario\`.`
          ]
        });

        successContainer
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
          .addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(BTN_PUBLISH_HERE_ID)
                .setLabel('Enviar Painel Neste Canal')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📤'),
              createEditImagesButton('Editar Novamente')
            )
          );

        return interaction.reply({
          components: [successContainer],
          flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
        });
      }

      // 3B. Submissão do Cadastro de Aniversário
      if (interaction.customId === MODAL_REGISTER_ID) {
        if (!interaction.guild) return;

        const dayRaw = getModalV2Value(INPUT_DAY_ID, interaction);
        const monthRaw = getModalV2Value(SELECT_MONTH_ID, interaction);

        const day = Number(dayRaw);
        const month = Number(monthRaw);

        const monthName = MONTH_NAMES[month - 1] || `Mês ${month}`;
        const maxDays = getMaxDaysInMonth(month);

        if (!month || !isValidBirthday(day, month)) {
          const errorContainer = createErrorContainer({
            title: 'Data Inválida!',
            message: `O dia **${dayRaw || '?'}** não é válido para o mês selecionado (**${monthName}**).`,
            hint: `Em ${monthName}, o dia deve estar entre 1 e ${maxDays}.`
          });

          if (interaction.replied || interaction.deferred) {
            return interaction.followUp({
              components: [errorContainer],
              flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
            }).catch(() => {});
          } else {
            return interaction.reply({
              components: [errorContainer],
              flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
            }).catch(() => {});
          }
        }

        await Birthday.findOneAndUpdate(
          {
            guildId: interaction.guild.id,
            userId: interaction.user.id
          },
          {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            day,
            month,
            lastNotifiedYear: null
          },
          { upsert: true, returnDocument: 'after' }
        );

        const daysUntil = getDaysUntilBirthday(day, month);
        const formattedDate = formatBirthday(day, month);

        let countdown = '';
        if (daysUntil === 0) {
          countdown = '🎉 **Seu aniversário é hoje! Parabéns!**';
        } else if (daysUntil === 1) {
          countdown = '⏳ **Falta apenas 1 dia!**';
        } else {
          countdown = `⏳ Faltam **${daysUntil} dias** para a sua data especial.`;
        }

        const successContainer = createSuccessContainer({
          title: 'Aniversário salvo com sucesso!',
          message: `Seus dados foram registrados com sucesso no banco de dados.`,
          details: [
            `• **Data Registrada:** 🗓️ **${formattedDate}**`,
            `• **Próxima Celebração:** ${countdown}`,
            `• O bot notificará o servidor automaticamente no dia do seu aniversário! 🎈`
          ]
        });

        if (interaction.replied || interaction.deferred) {
          return interaction.followUp({
            components: [successContainer],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
          }).catch(() => {});
        } else {
          return interaction.reply({
            components: [successContainer],
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
          }).catch(() => {});
        }
      }
    }
  } catch (error: any) {
    if (error?.code === 40060 || error?.code === 10062) {
      return;
    }

    console.error('❌ [InteractionHandler] Erro ao processar interação:', error);

    const errorContainer = createErrorContainer({
      title: 'Erro interno ao processar sua solicitação',
      message: error.message || 'Ocorreu uma falha inesperada.'
    });

    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          components: [errorContainer],
          flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
        }).catch(() => {});
      } else {
        await interaction.reply({
          components: [errorContainer],
          flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
        }).catch(() => {});
      }
    }
  }
}
