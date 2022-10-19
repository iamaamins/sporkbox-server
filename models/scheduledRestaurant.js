const { Schema, model } = require("mongoose");

const scheduledRestaurantSchema = new Schema(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide restaurant id"],
    },
    name: {
      type: String,
      required: [true, "Please provide restaurant name"],
    },
    scheduledOn: {
      type: Date,
      required: [true, "Please provide a schedule date"],
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

module.exports = model("ScheduledRestaurant", scheduledRestaurantSchema);
