import { Schema, model } from 'mongoose';
import { CompanySchema } from '../types';

const companySchema = new Schema<CompanySchema>(
  {
    name: {
      type: String,
      trim: true,
      required: [true, 'Please provide a name'],
    },
    shift: {
      type: String,
      trim: true,
      lowercase: true,
      enum: ['day', 'night', 'general'],
      required: [true, 'Please provide a shift'],
    },
    website: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Please provide a website'],
    },
    address: {
      city: {
        type: String,
        trim: true,
        required: [true, 'Please provide a city'],
      },
      state: {
        type: String,
        trim: true,
        required: [true, 'Please provide a state'],
      },
      zip: {
        type: String,
        trim: true,
        required: [true, 'Please provide a zip code'],
      },
      addressLine1: {
        type: String,
        trim: true,
        required: [true, 'Please provide address line 1'],
      },
      addressLine2: { type: String, trim: true },
    },
    code: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Please provide a code'],
    },
    shiftBudget: {
      type: Number,
      required: [true, 'Please provide a daily budget'],
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      required: [true, 'Please provide a status'],
    },
    slackChannel: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

export default model('Company', companySchema);
