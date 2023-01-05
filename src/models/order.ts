import { IOrderSchema } from "../types";
import { Schema, model } from "mongoose";

const orderSchema = new Schema<IOrderSchema>(
  {
    customer: {
      _id: {
        type: Schema.Types.ObjectId,
        required: [true, "Please provide customer id"],
      },
      firstName: {
        type: String,
        trim: true,
        required: [true, "Please provide customer first name"],
      },
      lastName: {
        type: String,
        trim: true,
        required: [true, "Please provide customer last name"],
      },
      email: {
        type: String,
        trim: true,
        required: [true, "Please provide customer email"],
      },
    },
    restaurant: {
      _id: {
        type: Schema.Types.ObjectId,
        required: [true, "Please provide restaurant id"],
      },
      name: {
        type: String,
        trim: true,
        required: [true, "Please provide restaurant name"],
      },
    },
    company: {
      _id: {
        type: Schema.Types.ObjectId,
        required: [true, "Please provide company id"],
      },
      name: {
        type: String,
        trim: true,
        required: [true, "Please provide company name"],
      },
    },
    delivery: {
      date: {
        type: Date,
        required: [true, "Please provide delivery date"],
      },
      address: {
        type: String,
        trim: true,
        required: [true, "Please provide delivery address"],
      },
    },
    status: {
      type: String,
      enum: ["PROCESSING", "DELIVERED", "ARCHIVED"],
      required: [true, "Please provide a status"],
    },
    hasReviewed: {
      type: Boolean,
      default: false,
    },
    item: {
      _id: {
        type: Schema.Types.ObjectId,
        required: [true, "Please provide an item id"],
      },
      name: {
        type: String,
        trim: true,
        required: [true, "Please provide the item name"],
      },
      tags: {
        type: String,
        trim: true,
        required: [true, "Please provide the item name"],
      },
      image: {
        type: String,
        trim: true,
        required: [true, "Please provide the item image"],
      },
      description: {
        type: String,
        trim: true,
        required: [true, "Please provide the item name"],
      },
      quantity: {
        type: Number,
        required: [true, "Please provide item quantity"],
      },
      total: {
        type: Number,
        required: [true, "Please provide a total price"],
      },
    },
  },
  {
    timestamps: true,
  }
);

export default model("Order", orderSchema);
