import { Types } from 'mongoose';
import { Shift } from './data/COMPANY';
import { EmailSubscriptions } from './data/EMAIL_SUBSCRIPTIONS';
import { Avatar } from './data/AVATARS';
import { Status } from './data/STATUS';

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
  website: string;
  code: string;
  shift: Shift;
  status: Status;
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
  optionalAddons: string;
  requiredAddonsOne: string;
  requiredAddonsTwo: string;
  removedIngredients: string;
}

export interface ItemSchema extends GenericItem {
  _id: Types.ObjectId;
  index: number;
  price: number;
  status: string;
  optionalAddons: Addons;
  requiredAddonsOne: Addons;
  requiredAddonsTwo: Addons;
  averageRating?: number;
  popularityIndex?: number;
  removableIngredients?: string;
  reviews: Types.DocumentArray<ReviewSchema>;
}

export interface OrderCompany {
  _id: Types.ObjectId;
  name: string;
  code: string;
  shift: Shift;
}

export interface OrderForEmail {
  _id: string;
  item: { name: string };
  customer: GenericUser;
  restaurant: { name: string };
}

export interface ReviewSchema {
  customer: Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface Addons {
  addons: string;
  addable: number;
}

export interface SchedulesSchema {
  date: Date;
  status: string;
  createdAt: string;
  company: OrderCompany;
  deactivatedByAdmin?: boolean;
}

export interface RestaurantSchema {
  name: string;
  logo: string;
  address: Address;
  status: Status;
  isFeatured: boolean;
  orderCapacity: number;
  items: Types.DocumentArray<ItemSchema>;
  schedules: Types.DocumentArray<SchedulesSchema>;
}

export type UserRole = 'ADMIN' | 'VENDOR' | 'CUSTOMER' | 'GUEST' | 'DRIVER';

export interface UserSchema extends GenericUser {
  _id: Types.ObjectId;
  email: string;
  role: UserRole;
  status: string;
  password: string;
  companies: UserCompany[];
  restaurant: Types.ObjectId;
  subscribedTo: EmailSubscriptions;
  foodPreferences?: string[];
  foodVibe?: string;
  avatar?: { id: Avatar };
  isCompanyAdmin?: boolean;
}

export interface FavRestaurantItem extends GenericItem {
  _id: Types.ObjectId;
  index: number;
  price: number;
  reviews: ReviewSchema[];
}

export interface OrdersPayload {
  orderItems: {
    itemId: string;
    quantity: number;
    companyId: string;
    restaurantId: string;
    deliveryDate: number;
    optionalAddons: string[];
    requiredAddonsOne: string[];
    requiredAddonsTwo: string[];
    removedIngredients: string[];
  }[];
  discountCodeId: string;
  employeeId?: string;
}

export interface UserCompany extends CompanyDetails {
  _id: Types.ObjectId;
  address: Address;
  isEnrolled: boolean;
  isEnrollAble: boolean;
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
  shift: Shift;
  date: number;
  total: number;
  companyId: string;
}

export interface CompanySchema extends CompanyDetails {
  _id: Types.ObjectId;
  address: Address;
  slackChannel?: string;
  createdAt: Date;
}

export type UpcomingDataMap = {
  [date: string]: {
    [company: string]: {
      [restaurant: string]: {
        orderCapacity: number;
        activeOrderCount: number;
        item: {
          [id: string]: {
            optionalAddons: { addons: string; addable: number };
            requiredAddonsOne: { addons: string; addable: number };
            requiredAddonsTwo: { addons: string; addable: number };
            removableIngredients?: string;
          };
        };
      };
    };
  };
};

export type Discount = {
  _id: Types.ObjectId;
  code: string;
  value: number;
  distributed?: number;
};

export type Order = {
  customer: {
    _id: Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
  };
  restaurant: { _id: Types.ObjectId; name: string };
  company: OrderCompany;
  delivery: {
    date: number;
    address: {
      city: string;
      state: string;
      zip: string;
      addressLine1: string;
      addressLine2?: string;
    };
  };
  discount?: Discount;
  status: 'PENDING' | 'PROCESSING';
  item: {
    _id: Types.ObjectId;
    name: string;
    tags: string;
    description: string;
    quantity: number;
    image: string;
    optionalAddons: string;
    requiredAddonsOne: string;
    requiredAddonsTwo: string;
    removedIngredients: string;
    total: number;
  };
  pendingKey?: string;
  payment?: { distributed?: number };
};
