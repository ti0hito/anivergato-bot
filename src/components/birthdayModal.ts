import {
  ButtonInteraction,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  MessageFlags
} from 'discord.js';
import { MONTH_OPTIONS } from '../utils/dateUtils.js';

export const MODAL_REGISTER_ID = 'modal_birthday_register';
export const INPUT_DAY_ID = 'birth_day';
export const SELECT_MONTH_ID = 'birth_month';

/**
 * Remove propriedade label conflitante em componentes aninhados
 */
const cleanJSON = (comp: any) => {
  const json = comp.toJSON();
  delete json.label;
  return json;
};

/**
 * Abre o Modal V2 do Discord contendo o Dropdown de Meses e o TextInput do Dia
 * Utiliza o wrapper type: 18 (Label/Form) com a flag IS_COMPONENTS_V2 (1 << 15)
 */
export async function openBirthdayV2Modal(
  interaction: ButtonInteraction,
  existingDay?: number,
  existingMonth?: number
): Promise<void> {
  // Prepara as opções de meses para o StringSelectMenu
  const monthOptions = MONTH_OPTIONS.map(opt => ({
    label: opt.label,
    value: opt.value,
    emoji: opt.emoji,
    description: opt.description,
    default: existingMonth ? opt.value === String(existingMonth) : false
  }));

  // Menu Dropdown de Meses
  const monthSelect = new StringSelectMenuBuilder()
    .setCustomId(SELECT_MONTH_ID)
    .setPlaceholder('Selecione o mês do seu aniversário...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(monthOptions);

  // Input de Texto para o Dia
  const dayInput = new TextInputBuilder()
    .setCustomId(INPUT_DAY_ID)
    .setPlaceholder('Ex: 25')
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(2)
    .setRequired(true);

  if (existingDay) {
    dayInput.setValue(String(existingDay));
  }

  // Estrutura do Modal V2 (Components V2) com type: 18
  const rawModalData = {
    type: 9, // Modal Callback
    data: {
      title: '🎂 Cadastro de Aniversário',
      custom_id: MODAL_REGISTER_ID,
      components: [
        {
          type: 18,
          label: '📅 Mês do seu aniversário',
          component: {
            ...monthSelect.toJSON(),
            required: true,
            min_values: 1
          }
        },
        {
          type: 18,
          label: '🗓️ Dia do seu nascimento (1 a 31)',
          component: cleanJSON(dayInput)
        }
      ]
    },
    flags: 1 << 15 // IS_COMPONENTS_V2
  };

  // Envia via REST bruto para suportar a nova estrutura de Modal V2 do Discord
  await (interaction.client.rest as any).post(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    { body: rawModalData }
  );
}

/**
 * Função utilitária para extrair valores de formulários V2 (TextInput e SelectMenu)
 */
export function getModalV2Value(customId: string, interaction: any): string | null {
  try {
    const val = interaction.fields?.getTextInputValue(customId);
    if (val !== undefined && val !== null) return val;
  } catch {}

  try {
    const vals = interaction.fields?.getStringSelectValues(customId);
    if (vals && vals.length > 0) return vals[0];
  } catch {}

  const components =
    interaction.components ||
    interaction.fields?.components ||
    interaction.data?.components ||
    interaction.raw?.data?.components ||
    [];

  for (const row of components) {
    const findComp = (c: any): any => {
      if (!c) return null;
      if (c.custom_id === customId || c.customId === customId) return c;
      if (Array.isArray(c.components)) {
        for (const sub of c.components) {
          const found = findComp(sub);
          if (found) return found;
        }
      }
      if (c.component) return findComp(c.component);
      return null;
    };

    const comp = findComp(row);
    if (comp) {
      if (comp.values !== undefined && Array.isArray(comp.values)) return comp.values[0] || null;
      if (comp.value !== undefined) return comp.value;
    }
  }

  return null;
}
