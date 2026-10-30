import { Interaction, MessageFlags } from 'discord.js';
import {
  openBirthdayV2Modal,
  getModalV2Value,
  MODAL_REGISTER_ID,
  INPUT_DAY_ID,
  SELECT_MONTH_ID
} from '../components/birthdayModal.js';
import { getActionForButtonId } from '../utils/presentationLoader.js';
import { Birthday } from '../models/Birthday.js';
import { isValidBirthday, formatBirthday, getDaysUntilBirthday, MONTH_NAMES, getMaxDaysInMonth } from '../utils/dateUtils.js';
import {
  createSuccessContainer,
  createErrorContainer,
  createBirthdayViewContainer,
  BTN_DELETE_SELF_ID
} from '../utils/containerFactory.js';

import * as painelCommand from '../commands/painel.js';
import * as aniversarioCommand from '../commands/aniversario.js';
import * as configCommand from '../commands/config.js';
import * as testarCommand from '../commands/testar.js';

const commands = new Map<string, any>([
  [painelCommand.data.name, painelCommand],
  [aniversarioCommand.data.name, aniversarioCommand],
  [configCommand.data.name, configCommand],
  [testarCommand.data.name, testarCommand]
]);

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

      const action = getActionForButtonId(interaction.customId);

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

        // Dispara o modal V2 do Discord contendo o Dropdown do Mês e o Input do Dia
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
          isSelf: true
        });

        return interaction.reply({
          components: [viewContainer],
          flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
        });
      }
    }

    // 3. Trata Envio do Modal V2 (Submissão com Dropdown e Input)
    if (interaction.isModalSubmit()) {
      if (interaction.customId === MODAL_REGISTER_ID) {
        if (!interaction.guild) return;

        // Extrai os valores do modal V2 usando o extrator flexível
        const dayRaw = getModalV2Value(INPUT_DAY_ID, interaction);
        const monthRaw = getModalV2Value(SELECT_MONTH_ID, interaction);

        const day = Number(dayRaw);
        const month = Number(monthRaw);

        const monthName = MONTH_NAMES[month - 1] || `Mês ${month}`;
        const maxDays = getMaxDaysInMonth(month);

        // Validação da data
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

        // Salva ou atualiza no MongoDB Atlas
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
      // Interação já respondida ou expirada
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
