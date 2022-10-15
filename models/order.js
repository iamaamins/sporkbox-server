const { Schema, model } = require("mongoose");

const orderSchema = new Schema(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide a customer id"],
    },
    items: [
      {
        _id: {
          type: Schema.Types.ObjectId,
          required: [true, "Please provide an item id"],
        },
        name: {
          type: String,
          required: [true, "Please provide the item name"],
        },
        quantity: {
          type: Number,
          required: [true, "Please provide item quantity"],
        },
        total: {
          type: Number,
          required: [true, "Please provide a total price"],
        },
        restaurant: {
          type: Schema.Types.ObjectId,
          ref: "Restaurant",
          required: [true, "Please provide a restaurant id"],
        },
        deliveryDate: {
          type: Date,
          required: [true, "Please provide a delivery date"],
        },
      },
    ],
    total: {
      type: Number,
      required: [true, "Please provide a total amount"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model("Order", orderSchema);
