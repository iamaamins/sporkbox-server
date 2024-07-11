import { Schema, model } from 'mongoose';
import {
  ItemSchema,
  RestaurantSchema,
  ReviewSchema,
  SchedulesSchema,
  SoldOutStatSchema,
} from '../types';

const soldOutStatSchema = new Schema<SoldOutStatSchema>({
  date: {
    type: Date,
    required: [true, 'Please provide a date'],
  },
  company: {
    type: Schema.Types.ObjectId,
    required: [true, 'Please provide a company id'],
  },
});

const reviewSchema = new Schema<ReviewSchema>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please provide a customer'],
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating'],
    },
    comment: {
      type: String,
      trim: true,
      required: [true, 'Please provide a rating'],
    },
  },
  { timestamps: true }
);

const itemSchema = new Schema<ItemSchema>({
  name: {
    type: String,
    trim: true,
    required: [true, 'Please provide item name'],
  },
  tags: {
    type: String,
    trim: true,
    required: [true, 'Please provide item tags'],
  },
  price: {
    type: Number,
    required: [true, 'Please provide item price'],
  },
  index: {
    type: Number,
    required: [true, 'Please provide item index'],
  },
  image: String,
  description: {
    type: String,
    trim: true,
    required: [true, 'Please provide item description'],
  },
  status: {
    type: String,
    enum: ['ARCHIVED', 'ACTIVE'],
    required: [true, 'Please provide a status'],
  },
  optionalAddons: {
    addons: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Please provide optional addons'],
    },
    addable: {
      type: Number,
      required: [true, 'Please provide optional addable'],
    },
  },
  requiredAddons: {
    addons: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, 'Please provide required addons'],
    },
    addable: {
      type: Number,
      required: [true, 'Please provide required addable'],
    },
  },
  removableIngredients: {
    type: String,
    trim: true,
    lowercase: true,
  },
  reviews: [reviewSchema],
  averageRating: Number,
  soldOutStat: [soldOutStatSchema],
});

const scheduleSchema = new Schema<SchedulesSchema>(
  {
    date: {
      type: Date,
      required: [true, 'Please provide a date'],
    },
    company: {
      _id: {
        type: Schema.Types.ObjectId,
        required: [true, 'Please provide a company id'],
      },
      name: {
        type: String,
        trim: true,
        required: [true, 'Please provide a company name'],
      },
      code: {
        type: String,
        trim: true,
        required: [true, 'Please provide company code'],
      },
      shift: {
        type: String,
        trim: true,
        required: [true, 'Please provide a shift'],
      },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      required: [true, 'Please provide a status'],
    },
    deactivatedByAdmin: Boolean,
  },
  { timestamps: true }
);

const restaurantSchema = new Schema<RestaurantSchema>(
  {
    name: {
      type: String,
      trim: true,
      required: [true, 'Please provide a name'],
    },
    logo: {
      type: String,
      trim: true,
      required: [true, 'Please provide a logo'],
    },
    address: {
      city: {
        type: String,
        trim: true,
        required: [true, 'Please provide a city'],
      },
      state: {
        type: String,
        trim: true,
        required: [true, 'Please provide a state'],
      },
      zip: {
        type: String,
        trim: true,
        required: [true, 'Please provide a zip code'],
      },
      addressLine1: {
        type: String,
        trim: true,
        required: [true, 'Please provide address line 1'],
      },
      addressLine2: {
        type: String,
        trim: true,
      },
    },
    isFeatured: {
      type: Boolean,
      required: [true, 'Please provide featured value'],
    },
    orderCapacity: {
      type: Number,
      default: Infinity,
    },
    items: [itemSchema],
    schedules: [scheduleSchema],
  },
  {
    timestamps: true,
  }
);

export default model('Restaurant', restaurantSchema);
