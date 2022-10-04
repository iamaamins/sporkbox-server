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
  },
  {
    timestamps: true,
  }
);

module.exports = model("User", userSchema);
