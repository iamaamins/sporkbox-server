const { Schema, model } = require("mongoose");

const scheduledRestaurantSchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: [true, "Please provide restaurant id"],
    },
    scheduledOn: {
      type: Date,
      required: [true, "Please provide a schedule date"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model("ScheduledRestaurant", scheduledRestaurantSchema);
