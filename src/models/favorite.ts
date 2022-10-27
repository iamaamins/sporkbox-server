import { Schema, model } from "mongoose";
import { IFavoriteSchema } from "../types";

const favoriteSchema = new Schema<IFavoriteSchema>({
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

export default model("Favorite", favoriteSchema);
