import mongoose, { Schema, Document, Model } from 'mongoose';
import type { IGuildConfig } from '../types/index.js';

export interface GuildConfigDocument extends IGuildConfig, Document {}

const GuildConfigSchema = new Schema<GuildConfigDocument>(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    announcementChannelId: {
      type: String,
      default: null
    },
    announcementRoleId: {
      type: String,
      default: null
    },
    panelChannelId: {
      type: String,
      default: null
    },
    panelMessageId: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const GuildConfig: Model<GuildConfigDocument> = mongoose.model<GuildConfigDocument>(
  'GuildConfig',
  GuildConfigSchema
);

