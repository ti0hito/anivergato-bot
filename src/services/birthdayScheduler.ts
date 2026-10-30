import cron from 'node-cron';
import { Client } from 'discord.js';
import { Birthday } from '../models/Birthday.js';
import { sendGuildBirthdaysNotification } from './notificationService.js';

/**
 * Retorna o dia, mês e ano no fuso horário do Brasil (America/Sao_Paulo)
 */
export function getLocalToday() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });

  const parts = formatter.formatToParts(now);
  const day = Number(parts.find(p => p.type === 'day')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const year = Number(parts.find(p => p.type === 'year')?.value);

  return { day, month, year };
}

/**
 * Executa a checagem de aniversários de hoje.
 * Se force = true, reenvia mesmo que já tenha sido notificado neste ano.
 * Agrupa os aniversariantes de cada servidor para enviar em uma ÚNICA mensagem harmoniosa.
 */
export async function checkTodayBirthdays(
  client: Client,
  force = false,
  targetGuildId?: string
): Promise<{ total: number; alreadyNotified: number; sent: number }> {
  const { day, month, year } = getLocalToday();
  console.log(`⏰ [Scheduler] Verificando aniversariantes de hoje: ${day}/${month}/${year} (force: ${force})`);

  try {
    const query: any = { day, month };
    if (targetGuildId) {
      query.guildId = targetGuildId;
    }

    // Busca todos os aniversariantes cadastrados para hoje no banco de dados
    const allToday = await Birthday.find(query);

    // Filtra aniversariantes pendentes neste ano (ou todos se force = true)
    const toNotify = force
      ? allToday
      : allToday.filter(b => b.lastNotifiedYear === null || b.lastNotifiedYear < year);

    const alreadyNotified = allToday.length - toNotify.length;

    // Agrupa por servidor (guildId)
    const guildMap = new Map<string, string[]>();
    for (const b of toNotify) {
      const list = guildMap.get(b.guildId) || [];
      list.push(b.userId);
      guildMap.set(b.guildId, list);
    }

    let sent = 0;
    for (const [guildId, userIds] of guildMap.entries()) {
      const count = await sendGuildBirthdaysNotification(client, guildId, userIds, year);
      sent += count;
    }

    console.log(
      `🎂 [Scheduler] ${allToday.length} aniversariante(s) | Já notificados: ${alreadyNotified} | Notificados agora: ${sent}`
    );

    return { total: allToday.length, alreadyNotified, sent };
  } catch (error: any) {
    console.error('❌ [Scheduler] Erro ao verificar aniversariantes:', error.message);
    return { total: 0, alreadyNotified: 0, sent: 0 };
  }
}

/**
 * Inicializa a rotina cron diária (por padrão roda às 09:00 no horário de Brasília)
 */
export function startBirthdayScheduler(client: Client) {
  // Roda todos os dias às 09:00 da manhã no fuso de São Paulo
  cron.schedule('0 9 * * *', async () => {
    await checkTodayBirthdays(client, false);
  }, {
    timezone: 'America/Sao_Paulo'
  });

  console.log('⏰ [Scheduler] Agendamento de aniversários iniciado (diariamente às 09:00 BRT).');
}
