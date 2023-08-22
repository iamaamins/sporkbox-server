import { Schema, model } from 'mongoose';

type DiscountCode = {
  code: string;
  value: number;
  totalRedeem: number;
  redeemability: 'once' | 'unlimited';
};

const discountCodeSchema = new Schema<DiscountCode>(
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
    totalRedeem: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

export default model('DiscountCode', discountCodeSchema);
