import { Schema, model } from "mongoose";
import { ICompanySchema } from "../types";

const companySchema = new Schema<ICompanySchema>(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
    },
    website: {
      type: String,
      lowercase: true,
      required: [true, "Please provide a website"],
    },
    address: {
      type: String,
      required: [true, "Please provide an address"],
    },
    code: {
      type: String,
      unique: true,
      lowercase: true,
      required: [true, "Please provide a code"],
    },
    dailyBudget: {
      type: Number,
      required: [true, "Please provide a daily budget"],
    },
  },
  {
    timestamps: true,
  }
);

export default model("Company", companySchema);
