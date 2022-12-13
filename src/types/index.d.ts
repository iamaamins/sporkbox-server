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
  customerId: Types.ObjectId;
  customerName: string;
  companyName: string;
  status: string;
  deliveryDate: Date;
  hasReviewed: boolean;
  customerEmail: string;
  deliveryAddress: string;
  restaurantName: string;
  item: {
    _id: Types.ObjectId;
    name: string;
    tags: string;
    description: string;
    quantity: number;
    total: number;
  };
  restaurantId: Types.ObjectId;
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
  name: string;
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

export interface IOrderItem {
  _id: string;
  quantity: number;
  deliveryDate: number;
  restaurantId: string;
}

export interface IOrder {
  customerId: Types.ObjectId;
  customerName: string;
  customerEmail: string;
  status: string;
  createdAt: Date;
  companyName: string;
  deliveryAddress: string;
  restaurantName: string;
  restaurantId: string;
  deliveryDate: number;
  item: {
    _id: string;
    name: string;
    quantity: number;
    total: number;
  };
}

export interface IUserCompany {
  _id: Types.ObjectId;
  name: string;
  address: string;
  dailyBudget: number;
}

interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  status?: string;
  company?: IUserCompany;
  // restaurant?: IRestaurant;
}
