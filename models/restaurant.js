const { Schema, model } = require("mongoose");

const restaurantSchema = new Schema(
  {
    owner: {
      id: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      name: {
        type: String,
        ref: "User",
        required: true,
      },
      email: {
        type: String,
        ref: "User",
        required: true,
      },
    },
    name: {
      type: String,
      required: [true, "Please add a name"],
    },
    address: {
      type: String,
      required: [true, "Please add an email"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model("Restaurant", restaurantSchema);
