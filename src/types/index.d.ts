import { Types } from "mongoose";

declare global {
  namespace Express {
    export interface Request {
      user?: IUser;
    }
  }
}

export interface ICompanySchema {
  name: string;
  website: string;
  address: string;
  code: string;
  dailyBudget: number;
}

export interface IFavoriteSchema {
  itemId: Types.ObjectId;
  customerId: Types.ObjectId;
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
    name: string;
  };
  delivery: {
    date: Date;
    address: string;
  };
  status: string;
  hasReviewed: boolean;
  createdAt: Date;
  item: {
    _id: Types.ObjectId;
    name: string;
    tags: string;
    description: string;
    quantity: number;
    total: number;
  };
}

interface IReviewSchema {
  customer: Types.ObjectId;
  rating: number;
  comment: string;
}

interface IItemSchema {
  name: string;
  tags: string;
  price: number;
  description: string;
  reviews: Types.DocumentArray<IReviewSchema>;
}

export interface IRestaurantSchema {
  name: string;
  address: string;
  schedules: Date[];
  items: Types.DocumentArray<IItemSchema>;
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
  role: string;
  password: string;
  status: string;
  company: Types.ObjectId;
  restaurant: Types.ObjectId;
}

export interface ISortScheduledRestaurant {
  scheduledOn: Date;
}

interface IRestaurantItem {
  _id: Types.ObjectId;
  name: string;
  tags: string;
  price: number;
  description: string;
  reviews: IReviewSchema[];
}

export interface IFavoriteRestaurant {
  _id: Types.ObjectId;
  name: string;
  items: IRestaurantItem[];
}

export interface IOrdersPayload {
  ordersPayload: {
    itemId: string;
    quantity: number;
    restaurantId: string;
    deliveryDate: number;
  }[];
}

export interface IUserCompany {
  _id: Types.ObjectId;
  name: string;
  address: string;
  dailyBudget: number;
}

interface IUser {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status?: string;
  company?: IUserCompany;
  // restaurant?: IRestaurant;
}

export interface ICompanyPayload {
  name: string;
  code: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  dailyBudget: number;
  addressLine1: string;
  addressLine2: string;
}

export interface ICustomerPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface IFavoritePayload {
  restaurantId: string;
  itemId: string;
}

export interface IScheduleRestaurantPayload {
  date: Date;
}

export interface IItemPayload {
  name: string;
  description: string;
  tags: string;
  price: number;
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
  password: string;
  city: string;
  state: string;
  zip: string;
  restaurantName: string;
  addressLine1: string;
  addressLine2: string;
}

export interface IVendorStatusPayload {
  action: string;
}
