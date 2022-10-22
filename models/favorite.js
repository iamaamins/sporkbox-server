const { Schema, model } = require("mongoose");

const favoriteSchema = new Schema({
  customerId: {
    type: Schema.Types.ObjectId,
    required: [true, "Please provide customer id"],
  },
  restaurantId: {
    type: Schema.Types.ObjectId,
    required: [true, "Please provide restaurant id"],
  },
  restaurantName: {
    type: String,
    required: [true, "Please provide restaurant name"],
  },
  itemId: {
    type: Schema.Types.ObjectId,
    required: [true, "Please provide item id"],
  },
  itemName: {
    type: String,
    required: [true, "Please provide item name"],
  },
});

module.exports = model("Favorite", favoriteSchema);
