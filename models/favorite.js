const { Schema, model } = require("mongoose");

const favoriteSchema = new Schema({
  customerId: {
    type: Schema.Types.ObjectId,
    required: [true, "Please provide customer id"],
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: "Restaurant",
    required: [true, "Please provide restaurant id"],
  },
  itemId: {
    type: Schema.Types.ObjectId,
    required: [true, "Please provide item id"],
  },
});

module.exports = model("Favorite", favoriteSchema);
