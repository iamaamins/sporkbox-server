const { Schema, model } = require("mongoose");

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      required: [true, "Please add an email"],
    },
    role: {
      type: String,
      enum: ["ADMIN", "VENDOR", "CUSTOMER"],
      required: [true, "Please provide a role"],
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
    },
    status: {
      type: String,
      enum: ["APPROVED", "PENDING"],
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

module.exports = model("User", userSchema);
