import { Schema, model } from "mongoose";
import { IFavoriteSchema } from "../types";

const favoriteSchema = new Schema<IFavoriteSchema>({
  customer: {
    type: Schema.Types.ObjectId,
    required: [true, "Please provide customer id"],
  },
  restaurant: {
    _id: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide restaurant id"],
    },
    name: {
      type: String,
      required: [true, "Please provide restaurant name"],
    },
  },
  item: {
    _id: {
      type: Schema.Types.ObjectId,
      required: [true, "Please provide item id"],
    },
    name: {
      type: String,
      required: [true, "Please provide item name"],
    },
    image: {
      type: String,
      required: [true, "Please provide item image"],
    },
  },
});

export default model("Favorite", favoriteSchema);
