import { SHIFTS } from '../data/COMPANY';
import { STATUS } from '../data/STATUS';
import { UserSchema } from '../types';
import { Schema, model } from 'mongoose';

const userSchema = new Schema<UserSchema>(
  {
    firstName: {
      type: String,
      trim: true,
      required: [true, 'Please provide a name'],
    },
    lastName: {
      type: String,
      trim: true,
      required: [true, 'Please provide a name'],
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: [true, 'Please provide an email'],
    },
    role: {
      type: String,
      enum: ['ADMIN', 'VENDOR', 'CUSTOMER', 'GUEST', 'DRIVER'],
      required: [true, 'Please provide a role'],
    },
    password: {
      type: String,
      trim: true,
      required: [true, 'Please provide a password'],
    },
    status: {
      type: String,
      enum: STATUS,
      required: [true, 'Please provide a status'],
    },
    companies: [
      {
        _id: Schema.Types.ObjectId,
        name: { type: String, trim: true },
        code: { type: String, trim: true, lowercase: true },
        status: { type: String, enum: STATUS },
        shift: { type: String, trim: true, enum: SHIFTS },
        shiftBudget: { type: Number },
        address: {
          city: { type: String, trim: true },
          state: { type: String, trim: true },
          zip: { type: String, trim: true },
          addressLine1: { type: String, trim: true },
          addressLine2: { type: String, trim: true },
        },
        isEnrolled: Boolean,
        isEnrollAble: Boolean,
      },
    ],
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant' },
    subscribedTo: {
      deliveryNotification: Boolean,
      orderReminder: Boolean,
      newsletter: Boolean,
    },
    foodPreferences: [{ type: String, trim: true }],
    foodVibe: { type: String, trim: true },
    isCompanyAdmin: Boolean,
    avatar: { id: { type: String, lowercase: true, trim: true } },
  },
  { timestamps: true }
);

export default model('User', userSchema);
