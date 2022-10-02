const { Schema, model } = require("mongoose");

const restaurantSchema = new Schema(
  {
    owner: {
      id: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Please provide owner id"],
      },
      name: {
        type: String,
        ref: "User",
        required: [true, "Please provide owner name"],
      },
      email: {
        type: String,
        ref: "User",
        required: [true, "Please provide owner email"],
      },
    },
    name: {
      type: String,
      required: [true, "Please provide a name"],
    },
    address: {
      type: String,
      required: [true, "Please provide an email"],
    },
    status: {
      type: String,
      enum: ["Approved", "Pending"],
      required: [true, "Please provide a status"],
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
          type: String,
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
