const { Schema, model } = require("mongoose");

// Order schema
const orderSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide customer id"],
    },
    customerName: {
      type: String,
      required: [true, "Please provide customer name"],
    },
    customerEmail: {
      type: String,
      required: [true, "Please provide customer email"],
    },
    shippingAddress: {
      type: String,
      required: [true, "Please provide shipping address"],
    },
    restaurantId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide restaurant id"],
    },
    restaurantName: {
      type: String,
      required: [true, "Please provide restaurant name"],
    },
    companyName: {
      type: String,
      required: [true, "Please provide company name"],
    },
    shippingDate: {
      type: Date,
      required: [true, "Please provide shipping date"],
    },
    status: {
      type: String,
      enum: ["PROCESSING", "DELIVERED"],
    },
    item: {
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
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model("Order", orderSchema);
