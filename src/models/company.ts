import { Schema, model } from "mongoose";

const companySchema = new Schema(
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
    budget: {
      type: Number,
      required: [true, "Please provide a budget"],
    },
  },
  {
    timestamps: true,
  }
);

export default model("Company", companySchema);
