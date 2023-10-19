import { Types } from 'mongoose';
import { subscriptions } from './utils';

declare global {
  namespace Express {
    export interface Request {
      user?: UserSchema;
    }
  }
}

export interface GenericUser {
  email: string;
  firstName: string;
  lastName: string;
}

export interface Address {
  city: string;
  state: string;
  zip: string;
  addressLine1: string;
  addressLine2?: string;
}

export interface CompanyDetails {
  name: string;
  shift: string;
  website: string;
  code: string;
  shiftBudget: number;
}

export interface OrderCustomer extends GenericUser {
  _id: Types.ObjectId;
}

export interface OrderRestaurant {
  _id: Types.ObjectId;
  name: string;
}

export interface GenericItem {
  name: string;
  tags: string;
  image: string;
  description: string;
}

export interface OrderItem extends GenericItem {
  _id: Types.ObjectId;
  total: number;
  quantity: number;
  optionalAddons?: string;
  requiredAddons?: string;
  removedIngredients?: string;
}

export interface ItemSchema extends GenericItem {
  index: number;
  price: number;
  status: string;
  optionalAddons: Addon[];
  requiredAddons: Addon[];
  removableIngredients: string;
  reviews: Types.DocumentArray<ReviewSchema>;
}

export interface OrderCompany {
  _id: Types.ObjectId;
  name: string;
  shift: string;
}

export interface OrderForEmail {
  item: {
    name: string;
  };
  customer: GenericUser;
  restaurant: {
    name: string;
  };
}

interface ReviewSchema {
  customer: Types.ObjectId;
  rating: number;
  comment: string;
}

export interface Addon {
  addons: string;
  addable: number;
}

interface SchedulesSchema {
  date: Date;
  status: string;
  createdAt: string;
  company: OrderCompany;
}

export interface RestaurantSchema {
  name: string;
  logo: string;
  address: Address;
  items: Types.DocumentArray<ItemSchema>;
  schedules: Types.DocumentArray<SchedulesSchema>;
}

export interface UserSchema extends GenericUser {
  _id: Types.ObjectId;
  email: string;
  password: string;
  status: string;
  shifts: string[];
  companies: UserCompany[];
  restaurant: Types.ObjectId;
  subscribedTo: typeof subscriptions;
  role: 'ADMIN' | 'VENDOR' | 'CUSTOMER';
}

export interface FavRestaurantItem extends GenericItem {
  _id: Types.ObjectId;
  index: number;
  price: number;
  reviews: ReviewSchema[];
}

export type OrderAddon = {
  index: number;
  addons: string[];
};

export interface OrdersPayload {
  items: {
    itemId: string;
    quantity: number;
    companyId: string;
    restaurantId: string;
    deliveryDate: number;
    optionalAddons: OrderAddon[];
    requiredAddons: OrderAddon[];
    removedIngredients: string[];
  }[];
  discountCodeId: string;
}

export interface UserCompany extends CompanyDetails {
  _id: Types.ObjectId;
  address: Address;
  status: 'ACTIVE' | 'ARCHIVED';
}

export interface StatusChangePayload {
  action: string;
}

export type DiscountCodeSchema = {
  code: string;
  value: number;
  totalRedeem: number;
  redeemability: 'once' | 'unlimited';
};

export interface DateTotal {
  shift: string;
  date: number;
  total: number;
  companyId: string;
}
