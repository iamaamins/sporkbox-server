const { Schema, model } = require("mongoose");

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
      type: String,
      required: [true, "Please provide a budget"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model("Company", companySchema);
