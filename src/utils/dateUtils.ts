export const MONTH_NAMES: readonly string[] = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
] as const;

export const MONTH_EMOJIS: readonly string[] = [
  '❄️', '🎭', '🌱', '🌧️', '🌸', '🌽',
  '🏖️', '☀️', '🍂', '🎃', '🦃', '🎄'
] as const;

export const MONTH_OPTIONS = MONTH_NAMES.map((name, index) => ({
  label: name,
  value: String(index + 1),
  emoji: { name: MONTH_EMOJIS[index] },
  description: `Mês ${index + 1}`
}));

/**
 * Converte qualquer entrada de mês (número "1"-"12", nome por extenso "Outubro", ou abreviação "out") para número 1-12
 */
export function parseMonth(input: string): number | null {
  if (!input) return null;
  const clean = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove acentos como em março -> marco

  const num = parseInt(clean, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return num;
  }

  const map: Record<string, number> = {
    jan: 1, janeiro: 1, january: 1,
    fev: 2, fevereiro: 2, feb: 2, february: 2,
    mar: 3, marco: 3, março: 3, march: 3,
    abr: 4, abril: 4, apr: 4, april: 4,
    mai: 5, maio: 5, may: 5,
    jun: 6, junho: 6, june: 6,
    jul: 7, julho: 7, july: 7,
    ago: 8, agosto: 8, aug: 8, august: 8,
    set: 9, setembro: 9, sep: 9, september: 9,
    out: 10, outubro: 10, oct: 10, october: 10,
    nov: 11, novembro: 11, november: 11,
    dez: 12, dezembro: 12, dec: 12, december: 12
  };

  return map[clean] ?? null;
}

/**
 * Retorna o limite de dias para um dado mês (1-12).
 * Fevereiro permite até 29 para aceitar aniversários bissextos.
 */
export function getMaxDaysInMonth(month: number): number {
  if (month === 2) return 29;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

/**
 * Valida se dia e mês são números e estão dentro do limite do calendário
 */
export function isValidBirthday(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > getMaxDaysInMonth(month)) return false;
  return true;
}

/**
 * Formata data no formato pt-BR: "25 de Dezembro"
 */
export function formatBirthday(day: number, month: number): string {
  const name = MONTH_NAMES[month - 1] || `Mês ${month}`;
  return `${day} de ${name}`;
}

/**
 * Calcula quantidade de dias restantes até o próximo aniversário
 */
export function getDaysUntilBirthday(day: number, month: number): number {
  const today = new Date();
  const currentYear = today.getFullYear();

  let nextDate = new Date(currentYear, month - 1, day);
  const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (nextDate.getTime() < todayReset.getTime()) {
    nextDate = new Date(currentYear + 1, month - 1, day);
  }

  const diffTime = nextDate.getTime() - todayReset.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
