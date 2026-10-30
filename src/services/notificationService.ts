import { Client, MessageFlags, TextChannel, GuildBasedChannel } from 'discord.js';
import { Birthday } from '../models/Birthday.js';
import { GuildConfig } from '../models/GuildConfig.js';
import { createCelebrationContainer } from '../utils/containerFactory.js';

/**
 * Envia uma mensagem comemorativa única reunindo todos os aniversariantes do dia daquele servidor
 */
export async function sendGuildBirthdaysNotification(
  client: Client,
  guildId: string,
  userIds: string[],
  currentYear: number
): Promise<number> {
  if (userIds.length === 0) return 0;

  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return 0;

    // Busca canal configurado no servidor
    const config = await GuildConfig.findOne({ guildId });
    let channel: GuildBasedChannel | null = null;

    if (config?.announcementChannelId) {
      channel = await guild.channels.fetch(config.announcementChannelId).catch(() => null);
    }

    // Se canal configurado não existir, tenta o canal de notificações do sistema do Discord
    if (!channel && guild.systemChannelId) {
      channel = await guild.channels.fetch(guild.systemChannelId).catch(() => null);
    }

    if (!channel || !(channel instanceof TextChannel)) {
      console.warn(`[Notification] Servidor ${guild.name} (${guildId}) não possui canal de texto para avisos.`);
      return 0;
    }

    // Monta o Container v2 festivo com todos os aniversariantes agrupados
    const roleMention = config?.announcementRoleId ? `<@&${config.announcementRoleId}>` : null;
    const container = createCelebrationContainer({
      userIds,
      guildName: guild.name,
      roleMention
    });

    await channel.send({
      components: [container],
      flags: [MessageFlags.IsComponentsV2]
    });

    // Atualiza o ano da notificação no banco de dados para todos os aniversariantes notificados
    await Birthday.updateMany(
      { guildId, userId: { $in: userIds } },
      { $set: { lastNotifiedYear: currentYear } }
    );

    const membersLabel = userIds.map(id => `<@${id}>`).join(', ');
    console.log(`🎂 [Notificação] Aniversário de [${membersLabel}] notificado em #${channel.name} (${guild.name})`);
    return userIds.length;
  } catch (error: any) {
    console.error(`❌ [Notification] Erro ao enviar felicitação em ${guildId}:`, error.message);
    return 0;
  }
}
