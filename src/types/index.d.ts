import { Types } from "mongoose";

interface IRestaurantItem {
  _id: Types.ObjectId;
  name: string;
  tags: string;
  price: number;
  description: string;
}

export interface IUpcomingWeekRestaurant {
  _id: Types.ObjectId;
  name: string;
  items: IRestaurantItem[];
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
  budget: number;
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
