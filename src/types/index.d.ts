import { Types } from 'mongoose';

declare global {
  namespace Express {
    export interface Request {
      user?: IUser;
    }
  }
}

export interface ICompanySchema {
  name: string;
  shift: string;
  website: string;
  address: {
    city: string;
    state: string;
    zip: string;
    addressLine1: string;
    addressLine2?: string;
  };
  code: string;
  status: string;
  createdAt: Date;
  shiftBudget: number;
}

export interface IFavoriteSchema {
  customer: Types.ObjectId;
  item: Types.ObjectId;
  restaurant: Types.ObjectId;
}

export interface IOrderSchema {
  customer: {
    _id: Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
  };
  restaurant: {
    _id: Types.ObjectId;
    name: string;
  };
  company: {
    _id: Types.ObjectId;
    name: string;
    shift: string;
  };

  delivery: {
    date: Date;
    address: {
      city: string;
      state: string;
      zip: string;
      addressLine1: string;
      addressLine2?: string;
    };
  };
  status: string;
  payment: {
    intent: string;
    amount: number;
  };
  hasReviewed: boolean;
  createdAt: Date;
  pendingOrderId?: string;
  item: {
    _id: Types.ObjectId;
    name: string;
    tags: string;
    image: string;
    description: string;
    quantity: number;
    total: number;
    optionalAddons?: string;
    requiredAddons?: string;
    removedIngredients?: string;
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

interface IItemSchema {
  name: string;
  index: number;
  tags: string;
  price: number;
  image: string;
  status: string;
  description: string;
  optionalAddons: IAddons;
  requiredAddons: IAddons;
  removableIngredients: string;
  reviews: Types.DocumentArray<IReviewSchema>;
}

export interface ISchedulesSchema {
  date: Date;
  company: {
    _id: Types.ObjectId;
    name: string;
    shift: string;
  };
  status: string;
  createdAt: string;
}

export interface IRestaurantSchema {
  name: string;
  logo: string;
  address: {
    city: string;
    state: string;
    zip: string;
    addressLine1: string;
    addressLine2?: string;
  };
  items: Types.DocumentArray<IItemSchema>;
  schedules: Types.DocumentArray<ISchedulesSchema>;
}

export interface IUpcomingWeekRestaurant {
  _id: string;
  name: string;
  scheduledOn: string;
  items: IRestaurantItem[];
}

export interface IUserSchema {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  status: string;
  shifts: string[];
  companies: IUserCompany[];
  restaurant: Types.ObjectId;
  role: 'ADMIN' | 'VENDOR' | 'CUSTOMER';
}

export interface ISortScheduledRestaurant {
  date: Date;
}

interface IRestaurantItem {
  _id: Types.ObjectId;
  name: string;
  index: number;
  tags: string;
  price: number;
  image: string;
  description: string;
  reviews: IReviewSchema[];
}

export interface IFavoriteRestaurant {
  _id: Types.ObjectId;
  name: string;
  logo: string;
  items: IRestaurantItem[];
}

export interface IOrdersPayload {
  ordersPayload: {
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

export interface IUserCompany {
  _id: Types.ObjectId;
  name: string;
  code: string;
  shift: string;
  address: {
    city: string;
    state: string;
    zip: string;
    addressLine1: string;
    addressLine2?: string;
  };
  status: string;
  shiftBudget: number;
}

interface IUser {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  shifts?: string[];
  companies?: IUserCompany[];
  role: 'ADMIN' | 'VENDOR' | 'CUSTOMER';
}

export interface ICompanyPayload {
  name: string;
  code: string;
  city: string;
  zip: string;
  state: string;
  shift: string;
  website: string;
  shiftBudget: number;
  addressLine1: string;
  addressLine2?: string;
}

export interface ICustomerPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyCode: string;
}

export interface IFavoritePayload {
  itemId: string;
  restaurantId: string;
}

export interface IScheduleRestaurantPayload {
  date: Date;
  companyId: string;
  restaurantId: string;
}

export interface IItemPayload {
  name: string;
  tags: string;
  price: string;
  index: string;
  image?: string;
  description: string;
  optionalAddons: string;
  requiredAddons: string;
  removableIngredients: string;
}

export interface IReviewPayload {
  rating: number;
  comment: string;
  orderId: string;
}

export interface ILoginPayload {
  email: string;
  password: string;
}

export interface IVendorPayload {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  city: string;
  state: string;
  zip: string;
  logo?: string;
  restaurantName: string;
  addressLine1: string;
  addressLine2?: string;
}

export interface IVendorStatusPayload {
  action: string;
}

export interface IOrdersStatusPayload {
  orderIds: string[];
}

export interface IOrder {
  customer: {
    _id: Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
  };
  restaurant: {
    _id: string;
    name: string;
  };
  company: {
    name: string;
  };
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
  status: string;
  item: {
    _id: string;
    name: string;
    tags: string;
    image: string;
    description: string;
    quantity: number;
    total: number;
  };
}

export interface IEditCustomerPayload {
  firstName: string;
  lastName: string;
  email: string;
}

export interface IStatusChangePayload {
  action: string;
}

export interface IResetPasswordPayload {
  password: string;
}

export interface IForgotPasswordPayload {
  email: string;
}

export interface IStripePayableOrders {
  date: string;
  items: string[];
  amount: number;
}

export interface IShiftChangePayload {
  shift: string;
}

export interface IItemsIndexPayload {
  reorderedItems: {
    _id: string;
    index: number;
  }[];
}

export type DiscountCodeSchema = {
  code: string;
  value: number;
  totalRedeem: number;
  redeemability: 'once' | 'unlimited';
};
