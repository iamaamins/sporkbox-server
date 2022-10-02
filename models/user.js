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
      required: [true, "Please add an email"],
    },
    role: {
      type: String,
      enum: ["admin", "vendor", "customer"],
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
