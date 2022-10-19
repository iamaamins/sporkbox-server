const { Schema, model } = require("mongoose");

const restaurantSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
    },
    address: {
      type: String,
      required: [true, "Please provide an email"],
    },
    items: [
      {
        name: {
          type: String,
          required: [true, "Please provide item name"],
        },
        tags: {
          type: String,
          required: [true, "Please provide item tags"],
        },
        price: {
          type: Number,
          required: [true, "Please provide item price"],
        },
        description: {
          type: String,
          required: [true, "Please provide item description"],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = model("Restaurant", restaurantSchema);
