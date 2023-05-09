import { Schema, model } from "mongoose";
import { IRestaurantSchema } from "../types";

const restaurantSchema = new Schema<IRestaurantSchema>(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "Please provide a name"],
    },
    logo: {
      type: String,
      trim: true,
      required: [true, "Please provide a logo"],
    },
    address: {
      city: {
        type: String,
        trim: true,
        required: [true, "Please provide a city"],
      },
      state: {
        type: String,
        trim: true,
        required: [true, "Please provide a state"],
      },
      zip: {
        type: String,
        trim: true,
        required: [true, "Please provide a zip code"],
      },
      addressLine1: {
        type: String,
        trim: true,
        required: [true, "Please provide address line 1"],
      },
      addressLine2: {
        type: String,
        trim: true,
      },
    },
    schedules: [
      new Schema(
        {
          date: {
            type: Date,
            required: [true, "Please provide a date"],
          },
          company: {
            _id: {
              type: Schema.Types.ObjectId,
              required: [true, "Please provide a company id"],
            },
            name: {
              type: String,
              trim: true,
              required: [true, "Please provide a company name"],
            },
            shift: {
              type: String,
              trim: true,
              required: [true, "Please provide a shift"],
            },
          },
          status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE"],
            required: [true, "Please provide a status"],
          },
        },
        { timestamps: true }
      ),
    ],
    items: [
      new Schema({
        name: {
          type: String,
          trim: true,
          required: [true, "Please provide item name"],
        },
        tags: {
          type: String,
          trim: true,
          required: [true, "Please provide item tags"],
        },
        price: {
          type: Number,
          required: [true, "Please provide item price"],
        },
        image: String,
        description: {
          type: String,
          trim: true,
          required: [true, "Please provide item description"],
        },
        status: {
          type: String,
          enum: ["ARCHIVED", "ACTIVE"],
          required: [true, "Please provide a status"],
        },
        optionalAddons: {
          addons: {
            type: String,
            trim: true,
            lowercase: true,
          },
          addable: {
            type: Number,
          },
        },
        requiredAddons: {
          addons: {
            type: String,
            trim: true,
            lowercase: true,
          },
          addable: {
            type: Number,
          },
        },
        removableIngredients: {
          type: String,
          trim: true,
          lowercase: true,
        },
        reviews: [
          new Schema({
            customer: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: [true, "Please provide a customer"],
            },
            rating: {
              type: Number,
              required: [true, "Please provide a rating"],
            },
            comment: {
              type: String,
              trim: true,
              required: [true, "Please provide a rating"],
            },
          }),
        ],
      }),
    ],
  },
  {
    timestamps: true,
  }
);

export default model("Restaurant", restaurantSchema);
