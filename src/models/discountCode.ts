import { Schema, model } from 'mongoose';
import { DiscountCodeSchema } from '../types';

const discountCodeSchema = new Schema<DiscountCodeSchema>(
  {
    code: {
      type: String,
      trim: true,
      unique: true,
      lowercase: true,
      required: [true, 'Please provide a discount code'],
    },
    value: {
      type: Number,
      required: [true, 'Please provide a discount value'],
    },
    redeemability: {
      type: String,
      enum: ['once', 'unlimited'],
      required: [true, 'Please provide a redeemable value'],
    },
    totalRedeem: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model('DiscountCode', discountCodeSchema);
