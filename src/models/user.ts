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
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
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
