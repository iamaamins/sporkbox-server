import { Schema, model } from "mongoose";
import { ICompanySchema } from "../types";

const companySchema = new Schema<ICompanySchema>(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "Please provide a name"],
    },
    website: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, "Please provide a website"],
    },
    address: {
      type: String,
      trim: true,
      required: [true, "Please provide an address"],
    },
    code: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: [true, "Please provide a code"],
    },
    dailyBudget: {
      type: Number,
      required: [true, "Please provide a daily budget"],
    },
    status: {
      type: String,
      enum: ["ARCHIVED", "ACTIVE"],
      required: [true, "Please provide a status"],
    },
  },
  {
    timestamps: true,
  }
);

export default model("Company", companySchema);
