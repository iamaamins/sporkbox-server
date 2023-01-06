import { Schema, model } from "mongoose";
import { IFavoriteSchema } from "../types";

const favoriteSchema = new Schema<IFavoriteSchema>({
  customer: {
    type: Schema.Types.ObjectId,
    required: [true, "Please provide customer id"],
  },
  item: {
    type: Schema.Types.ObjectId,
    required: [true, "Please provide item id"],
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: "Restaurant",
    required: [true, "Please provide restaurant id"],
  },
});

export default model("Favorite", favoriteSchema);
