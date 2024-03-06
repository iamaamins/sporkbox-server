import { Schema, Types, model } from 'mongoose';

export interface FavoriteSchema {
  customer: Types.ObjectId;
  item: Types.ObjectId;
  restaurant: Types.ObjectId;
}

const favoriteSchema = new Schema<FavoriteSchema>({
  customer: {
    type: Schema.Types.ObjectId,
    required: [true, 'Please provide customer id'],
  },
  item: {
    type: Schema.Types.ObjectId,
    required: [true, 'Please provide item id'],
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: [true, 'Please provide restaurant id'],
  },
});

export default model('Favorite', favoriteSchema);
