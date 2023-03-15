import { IUserSchema } from "../types";
import { Schema, model } from "mongoose";

const userSchema = new Schema<IUserSchema>(
  {
    firstName: {
      type: String,
      trim: true,
      required: [true, "Please provide a name"],
    },
    lastName: {
      type: String,
      trim: true,
      required: [true, "Please provide a name"],
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: [true, "Please provide an email"],
    },
    role: {
      type: String,
      enum: ["ADMIN", "VENDOR", "CUSTOMER"],
      required: [true, "Please provide a role"],
    },
    password: {
      type: String,
      trim: true,
      required: [true, "Please provide a password"],
    },
    status: {
      type: String,
      enum: ["ARCHIVED", "ACTIVE"],
      required: [true, "Please provide a status"],
    },
    companies: [
      {
        _id: {
          type: Schema.Types.ObjectId,
          required: [true, "Please provide an id"],
        },
        name: {
          type: String,
          trim: true,
          required: [true, "Please provide a name"],
        },
        shift: {
          type: String,
          trim: true,
          lowercase: true,
          required: [true, "Please provide a shift"],
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
        code: {
          type: String,
          trim: true,
          lowercase: true,
          required: [true, "Please provide a code"],
        },
        dailyBudget: {
          type: Number,
          required: [true, "Please provide a daily budget"],
        },
      },
    ],
    shifts: [
      {
        type: String,
        trim: true,
        enum: ["day", "night"],
      },
    ],
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
    },
  },
  {
    timestamps: true,
  }
);

export default model("User", userSchema);
