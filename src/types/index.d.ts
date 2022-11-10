import { Types } from "mongoose";

export interface ICompanySchema {
  name: string;
  website: string;
  address: string;
  code: string;
  dailyBudget: number;
}

export interface IFavoriteSchema {
  customerId: Types.ObjectId;
  restaurant: Types.ObjectId;
  itemId: Types.ObjectId;
}

export interface IOrderSchema {
  customerId: Types.ObjectId;
  customerName: string;
  customerEmail: string;
  deliveryAddress: string;
  restaurantName: string;
  companyName: string;
  deliveryDate: Date;
  status: string;
  hasReviewed: boolean;
  restaurantId: Types.ObjectId;
  item: {
    _id: Types.ObjectId;
    name: string;
    quantity: number;
    total: number;
  };
}

interface IReview {
  customer: Types.ObjectId;
  rating: number;
  comment: string;
}

interface IItem {
  name: string;
  tags: string;
  price: number;
  description: string;
  reviews: Types.DocumentArray<IReview>;
}

export interface IRestaurantSchema {
  name: string;
  address: string;
  schedules: Date[];
  items: Types.DocumentArray<IItem>;
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

export interface IFavorite {
  _id: Types.ObjectId;
  name: string;
  items: IRestaurantItem[];
}

export interface IOrderItem {
  _id: string;
  name: string;
  total: number;
  quantity: number;
  deliveryDate: number;
  restaurantId: string;
  restaurantName: string;
}

export interface IUserCompany {
  _id: Types.ObjectId;
  name: string;
  address: string;
  dailyBudget: number;
}

export interface IRestaurant {
  _id: Types.ObjectId;
  name: string;
  address: string;
  items: IRestaurantItem[];
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

declare global {
  namespace Express {
    export interface Request {
      user?: IUser;
    }
  }
}
