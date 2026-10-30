export interface IBirthday {
  userId: string;
  guildId: string;
  day: number;
  month: number;
  lastNotifiedYear: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGuildConfig {
  guildId: string;
  announcementChannelId: string | null;
  announcementRoleId: string | null;
  panelChannelId: string | null;
  panelMessageId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ExtractedButton {
  custom_id: string;
  label?: string;
  style?: number;
  emoji?: {
    name?: string;
    id?: string;
    animated?: boolean;
  };
}

export type BirthdayAction = 'register' | 'view' | 'remove' | string;

export interface PresentationConfig {
  success: boolean;
  error?: string;
  raw?: Record<string, unknown>;
  payload: {
    flags: number;
    components: unknown[];
    content?: string;
  };
  buttons: ExtractedButton[];
  buttonIds: string[];
  actionMap: Map<string, BirthdayAction>;
}

