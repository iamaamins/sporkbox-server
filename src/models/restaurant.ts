import { Schema, model } from "mongoose";
import { IRestaurantSchema } from "../types";

const restaurantSchema = new Schema<IRestaurantSchema>(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
    },
    address: {
      type: String,
      required: [true, "Please provide an email"],
    },
    schedules: [
      {
        type: Date,
      },
    ],
    items: [
      {
        name: {
          type: String,
          required: [true, "Please provide item name"],
        },
        tags: {
          type: String,
          required: [true, "Please provide item tags"],
        },
        price: {
          type: Number,
          required: [true, "Please provide item price"],
        },
        description: {
          type: String,
          required: [true, "Please provide item description"],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default model("Restaurant", restaurantSchema);
