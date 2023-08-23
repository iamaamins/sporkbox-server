import { Types } from 'mongoose';

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

interface GenericItem {
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

export interface IItemSchema extends GenericItem {
  index: number;
  price: number;
  status: string;
  optionalAddons: IAddons;
  requiredAddons: IAddons;
  removableIngredients: string;
  reviews: Types.DocumentArray<IReviewSchema>;
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

interface IReviewSchema {
  customer: Types.ObjectId;
  rating: number;
  comment: string;
}

export interface IAddons {
  addons: string;
  addable: number;
}

export interface ISchedulesSchema {
  date: Date;
  status: string;
  createdAt: string;
  company: OrderCompany;
}

export interface IRestaurantSchema {
  name: string;
  logo: string;
  address: Address;
  items: Types.DocumentArray<IItemSchema>;
  schedules: Types.DocumentArray<ISchedulesSchema>;
}

export interface UserSchema extends GenericUser {
  _id: Types.ObjectId;
  email: string;
  password: string;
  status: string;
  shifts: string[];
  companies: IUserCompany[];
  restaurant: Types.ObjectId;
  role: 'ADMIN' | 'VENDOR' | 'CUSTOMER';
}

interface FavRestaurantItem extends GenericItem {
  _id: Types.ObjectId;
  index: number;
  price: number;
  reviews: IReviewSchema[];
}

export interface IFavoriteRestaurant {
  _id: Types.ObjectId;
  name: string;
  logo: string;
  items: FavRestaurantItem[];
}

export interface IOrdersPayload {
  items: {
    itemId: string;
    quantity: number;
    companyId: string;
    restaurantId: string;
    deliveryDate: number;
    optionalAddons: string[];
    requiredAddons: string[];
    removedIngredients: string[];
  }[];
  discountCodeId: string;
}

export interface IUserCompany extends CompanyDetails {
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
