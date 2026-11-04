import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  User
} from 'discord.js';
import { formatBirthday } from './dateUtils.js';

export const COLORS = {
  PRIMARY: 0x5865F2,     // Blurple
  SUCCESS: 0x2ECC71,     // Verde
  WARNING: 0xF1C40F,     // Amarelo / Dourado
  ERROR: 0xED4245,       // Vermelho
  CELEBRATION: 0xFF69B4, // Rosa Festivo
  INFO: 0x3498DB        // Azul Claro
} as const;

export interface SuccessContainerOptions {
  title?: string;
  message?: string;
  details?: string[];
}

export function createSuccessContainer({
  title = 'Sucesso!',
  message,
  details = []
}: SuccessContainerOptions): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.SUCCESS)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ✅ ${title}`)
    );

  if (message) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(message)
    );
  }

  if (details.length > 0) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    for (const detail of details) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(detail)
      );
    }
  }

  return container;
}

export interface ErrorContainerOptions {
  title?: string;
  message?: string;
  hint?: string;
}

export function createErrorContainer({
  title = 'Ops! Algo deu errado',
  message,
  hint
}: ErrorContainerOptions): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.ERROR)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ❌ ${title}`)
    );

  if (message) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(message)
    );
  }

  if (hint) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`💡 *Dica:* ${hint}`)
    );
  }

  return container;
}

export interface BirthdayViewOptions {
  user: User;
  day: number;
  month: number;
  daysUntil: number;
  isSelf?: boolean;
}

export const BTN_DELETE_SELF_ID = 'btn_birthday_delete_self';

export function createBirthdayViewContainer({
  user,
  day,
  month,
  daysUntil,
  isSelf = true
}: BirthdayViewOptions): ContainerBuilder {
  const formatted = formatBirthday(day, month);
  let countdownText = '';

  if (daysUntil === 0) {
    countdownText = '🎉 **É HOJE! Parabéns pelo seu dia especial!** 🎂';
  } else if (daysUntil === 1) {
    countdownText = '⏳ Falta apenas **1 dia** para o aniversário!';
  } else {
    countdownText = `⏳ Faltam **${daysUntil} dias** para o próximo aniversário.`;
  }

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.INFO)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        isSelf ? '# 🎂 Seu Aniversário' : `# 🎂 Aniversário de ${user.username}`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `• **Membro:** <@${user.id}>\n• **Data Registrada:** 🗓️ **${formatted}**\n• **Contagem Regressiva:** ${countdownText}`
      )
    );

  // Se estiver visualizando o próprio cadastro, adiciona o botão para remover com 1 clique
  if (isSelf) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(BTN_DELETE_SELF_ID)
            .setLabel('Remover Meu Cadastro')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
        )
      );
  }

  return container;
}

export interface CelebrationOptions {
  userIds: string[];
  guildName: string;
  roleMention?: string | null;
  gifUrl?: string | null;
}

// GIF festivo comemorativo padrão (Gatinho de aniversário com bolo de festa)
export const DEFAULT_CELEBRATION_GIF = 'https://i.imgur.com/76DUCCx.gif';

/**
 * Cria o container comemorativo festivo.
 * Se houver mais de 1 aniversariante no mesmo dia, agrupa todos harmoniosamente no mesmo card!
 */
export function createCelebrationContainer({
  userIds,
  guildName,
  roleMention = null,
  gifUrl = DEFAULT_CELEBRATION_GIF
}: CelebrationOptions): ContainerBuilder {
  const greeting = roleMention ? `${roleMention} ` : '';
  const isMultiple = userIds.length > 1;

  let title = '# 🎂🎉 HOJE É UM DIA MUITO ESPECIAL!';
  let description = '';

  if (isMultiple) {
    title = userIds.length === 2
      ? '# 🎂🎉 CELEBRAÇÃO EM DOSE DUPLA!'
      : '# 🎂🎉 HOJE É DIA DE FESTA NO SERVIDOR!';

    const membersList = userIds.map(id => `• <@${id}> 🍰`).join('\n');

    description = `${greeting}Hoje o dia é duplamente especial! Temos **${userIds.length} membros** comemorando aniversário no **${guildName}**! 🎈✨\n\n${membersList}\n\nQue o novo ciclo de vocês venha repleto de muitas conquistas, saúde, felicidade e muita comemoração! 🎁🍰\n\n*Deixem seus parabéns abaixo!* 👇`;
  } else {
    const singleUserId = userIds[0];
    description = `${greeting}Hoje todos nós do **${guildName}** celebramos o aniversário de <@${singleUserId}>! 🎈✨\n\nQue seu novo ciclo venha repleto de conquistas, saúde, felicidade e muitos pedaços de bolo! 🍰🎁\n\n*Deixe seus parabéns abaixo!* 👇`;
  }

  const container = new ContainerBuilder()
    .setAccentColor(COLORS.CELEBRATION)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(title))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(description));

  if (gifUrl) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(gifUrl)
        )
      );
  }

  return container;
}

export interface BirthdayListEntry {
  userId: string;
  day: number;
  month: number;
}

export function createBirthdayListContainer(
  title: string,
  list: BirthdayListEntry[]
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(COLORS.PRIMARY)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 📅 ${title}`)
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (list.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Nenhum aniversário cadastrado ainda neste servidor.')
    );
  } else {
    const textLines = list
      .map(item => `• <@${item.userId}> — 🗓️ **${formatBirthday(item.day, item.month)}**`)
      .join('\n');

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(textLines)
    );
  }

  return container;
}
