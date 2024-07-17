import { Schema, model } from 'mongoose';
import {
  Address,
  Discount,
  OrderItem,
  OrderCompany,
  OrderCustomer,
  OrderRestaurant,
} from '../types';

interface OrderSchema {
  customer: OrderCustomer;
  restaurant: OrderRestaurant;
  company: OrderCompany;
  delivery: {
    date: Date;
    address: Address;
  };
  status: string;
  payment?: {
    intent: string;
    total: number;
    distributed: number;
  };
  item: OrderItem;
  createdAt: Date;
  isReviewed?: boolean;
  discount?: Discount;
  pendingOrderId?: string;
}

const orderSchema = new Schema<OrderSchema>(
  {
    customer: {
      _id: {
        type: Schema.Types.ObjectId,
        required: [true, 'Please provide customer id'],
      },
      firstName: {
        type: String,
        trim: true,
        required: [true, 'Please provide customer first name'],
      },
      lastName: {
        type: String,
        trim: true,
        required: [true, 'Please provide customer last name'],
      },
      email: {
        type: String,
        trim: true,
        required: [true, 'Please provide customer email'],
      },
    },

    restaurant: {
      _id: {
        type: Schema.Types.ObjectId,
        required: [true, 'Please provide restaurant id'],
      },
      name: {
        type: String,
        trim: true,
        required: [true, 'Please provide restaurant name'],
      },
    },
    company: {
      _id: {
        type: Schema.Types.ObjectId,
        required: [true, 'Please provide company id'],
      },
      name: {
        type: String,
        trim: true,
        required: [true, 'Please provide company name'],
      },
      code: {
        type: String,
        trim: true,
        required: [true, 'Please provide company code'],
      },
      shift: {
        type: String,
        trim: true,
        required: [true, 'Please provide company name'],
      },
    },
    delivery: {
      date: {
        type: Date,
        required: [true, 'Please provide delivery date'],
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
    },
    payment: {
      intent: String,
      total: Number,
      distributed: Number,
    },
    isReviewed: {
      type: Boolean,
      default: false,
    },
    pendingOrderId: String,
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'DELIVERED', 'ARCHIVED', 'CANCELLED'],
      required: [true, 'Please provide a status'],
    },
    discount: {
      _id: Schema.Types.ObjectId,
      code: String,
      value: Number,
      distributed: Number,
    },
    item: {
      _id: {
        type: Schema.Types.ObjectId,
        required: [true, 'Please provide an item id'],
      },
      name: {
        type: String,
        trim: true,
        required: [true, 'Please provide the item name'],
      },
      tags: {
        type: String,
        trim: true,
        required: [true, 'Please provide the item name'],
      },
      image: {
        type: String,
        trim: true,
        required: [true, 'Please provide the item image'],
      },
      description: {
        type: String,
        trim: true,
        required: [true, 'Please provide the item name'],
      },
      quantity: {
        type: Number,
        required: true,
      },
      total: {
        type: Number,
        required: true,
      },
      optionalAddons: {
        type: String,
        trim: true,
        lowercase: true,
      },
      requiredAddons: {
        type: String,
        trim: true,
        lowercase: true,
      },
      removedIngredients: {
        type: String,
        trim: true,
        lowercase: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default model('Order', orderSchema);
