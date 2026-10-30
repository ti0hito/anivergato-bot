import mongoose, { Schema, Document, Model } from 'mongoose';
import type { IBirthday } from '../types/index.js';

export interface BirthdayDocument extends IBirthday, Document {}

const BirthdaySchema = new Schema<BirthdayDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    guildId: {
      type: String,
      required: true,
      index: true
    },
    day: {
      type: Number,
      required: true,
      min: 1,
      max: 31
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    lastNotifiedYear: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true
  }
);

BirthdaySchema.index({ guildId: 1, userId: 1 }, { unique: true });
BirthdaySchema.index({ day: 1, month: 1 });

export const Birthday: Model<BirthdayDocument> = mongoose.model<BirthdayDocument>(
  'Birthday',
  BirthdaySchema
);

