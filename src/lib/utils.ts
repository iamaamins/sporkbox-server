import sharp from 'sharp';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Document, Types } from 'mongoose';
import Order from '../models/order';
import Restaurant from '../models/restaurant';
import { invalidShift } from './messages';
import DiscountCode from '../models/discountCode';
import {
  Addons,
  DateTotal,
  Order as OrderType,
  UserCompany,
  UserRole,
} from '../types';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import moment from 'moment';

type SortScheduledRestaurant = {
  schedule: {
    date: Date;
  };
};

type ActiveOrder = {
  _id: Types.ObjectId;
  delivery: {
    date: Date;
  };
  restaurant: {
    _id: Types.ObjectId;
  };
  item: {
    quantity: number;
  };
};

export const setCookie = (res: Response, _id: Types.ObjectId): void => {
  const jwtToken = jwt.sign({ _id }, process.env.JWT_SECRET as string, {
    expiresIn: '7d',
  });

  res.cookie('token', jwtToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    secure: process.env.NODE_ENV !== 'development',
  });
};

export const deleteFields = (data: object, moreFields?: string[]): void => {
  let fields = ['__v', 'updatedAt'];
  if (moreFields) {
    fields = [...fields, ...moreFields];
  }
  fields.forEach((field) => delete data[field as keyof object]);
};

export const toUSNumber = (number: number) => +number.toLocaleString('en-US');

export const dateToMS = (date: Date | string): number =>
  new Date(date).getTime();

export const sortByDate = (
  a: SortScheduledRestaurant,
  b: SortScheduledRestaurant
): number => dateToMS(a.schedule.date) - dateToMS(b.schedule.date);

export const getTodayTimestamp = () =>
  dateToMS(moment().utc().format('YYYY-MM-DD'));

export async function getUpcomingRestaurants(
  res: Response,
  companies: UserCompany[],
  getActiveSchedules?: boolean
) {
  const activeCompany = companies.find(
    (company) => company.status === 'ACTIVE'
  );
  if (!activeCompany) {
    console.log('No enrolled shift found');
    res.status(400);
    throw new Error('No enrolled shift found');
  }

  try {
    const scheduledRestaurants = await Restaurant.find({
      status: 'ACTIVE',
      schedules: {
        $elemMatch: {
          date: { $gt: getTodayTimestamp() },
          'company._id': activeCompany._id,
          ...(getActiveSchedules && { status: 'ACTIVE' }),
        },
      },
    })
      .select('-__v -updatedAt -createdAt -address')
      .lean();

    const upcomingRestaurants = [];
    for (const scheduledRestaurant of scheduledRestaurants) {
      const items = scheduledRestaurant.items
        .filter((item) => item.status === 'ACTIVE')
        .sort((a, b) => a.index - b.index)
        .map((item) => ({
          ...item,
          reviews: item.reviews.sort(
            (a, b) => dateToMS(b.createdAt) - dateToMS(a.createdAt)
          ),
        }));

      const { schedules, ...rest } = scheduledRestaurant;
      for (const schedule of schedules) {
        if (
          dateToMS(schedule.date) > getTodayTimestamp() &&
          (getActiveSchedules ? schedule.status === 'ACTIVE' : true) &&
          activeCompany._id.toString() === schedule.company._id.toString()
        ) {
          const upcomingRestaurant = {
            ...rest,
            items,
            company: {
              _id: schedule.company._id,
              shift: schedule.company.shift,
            },
            schedule: {
              date: schedule.date,
              status: schedule.status,
              createdAt: schedule.createdAt,
            },
          };
          upcomingRestaurants.push(upcomingRestaurant);
        }
      }
    }
    return upcomingRestaurants.sort(sortByDate);
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export function checkActions(
  actions = ['Archive', 'Activate'],
  action: string,
  res: Response
) {
  if (!actions.includes(action)) {
    console.log('Please provide valid action');
    res.status(400);
    throw new Error('Please provide valid action');
  }
}

export function checkShift(res: Response, shift: string) {
  if (!['day', 'night'].includes(shift)) {
    console.log(invalidShift);
    res.status(400);
    throw new Error(invalidShift);
  }
}

export async function resizeImage(
  res: Response,
  buffer: Buffer,
  width: number,
  height: number
) {
  try {
    return await sharp(buffer)
      .resize({
        width,
        height,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 },
      })
      .toBuffer();
  } catch (err) {
    console.log('Failed to resize image');
    res.status(500);
    throw new Error('Failed to resize image');
  }
}

export const dateToText = (date: Date | string | number): string =>
  new Date(date).toUTCString().split(' ').slice(0, 3).join(' ');

export const generateRandomString = () =>
  crypto.randomBytes(16).toString('hex');

export const splitAddons = (addons: string) =>
  addons
    .split(',')
    .map((ingredient) => ingredient.trim())
    .map((ingredient) =>
      ingredient.split('-').map((ingredient) => ingredient.trim())
    );

export const isCorrectAddonsFormat = (parsedAddons: Addons) =>
  splitAddons(parsedAddons.addons).every(
    (ingredient) =>
      ingredient.length === 2 &&
      ingredient[1] !== '' &&
      +ingredient[1] >= 0 &&
      splitAddons(parsedAddons.addons).length >= parsedAddons.addable
  );

export const formatAddons = (parsedAddons: Addons) => ({
  addons: splitAddons(parsedAddons.addons)
    .map((ingredient) => ingredient.join(' - '))
    .join(', '),
  addable: parsedAddons.addable || splitAddons(parsedAddons.addons).length,
});

// Skip middleware for specific routes/paths
export function unless(path: string, middleware: RequestHandler) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (path === req.path) {
      return next();
    } else {
      return middleware(req, res, next);
    }
  };
}

export const sortIngredients = (a: string, b: string) =>
  a.toLowerCase().localeCompare(b.toLowerCase());

export function getDateTotal(details: DateTotal[]) {
  const dateTotalMap: Record<string, DateTotal> = {};
  for (const detail of details) {
    const key = detail.date;
    if (!dateTotalMap[key]) {
      dateTotalMap[key] = structuredClone(detail);
    } else {
      dateTotalMap[key].total += detail.total;
    }
  }
  return Object.values(dateTotalMap);
}

export const createAddons = (addons: string[]) =>
  addons.map((addon) => addon.split('-')[0].trim());

export const getAddonsPrice = (serverAddons: string, clientAddons: string[]) =>
  serverAddons
    ? splitAddons(serverAddons)
        .filter((addon) => clientAddons.includes(addon[0]))
        .reduce((acc, curr) => acc + +curr[1], 0)
    : 0;

export function checkOrderCapacity(
  deliveryDate: number,
  restaurantId: string,
  currQuantity: number,
  orderCapacity: number,
  activeOrders: ActiveOrder[]
) {
  let orderedQuantity = 0;
  for (const activeOrder of activeOrders) {
    if (
      dateToMS(activeOrder.delivery.date) === deliveryDate &&
      activeOrder.restaurant._id.toString() === restaurantId
    ) {
      orderedQuantity += activeOrder.item.quantity;
    }
  }
  return orderCapacity + 3 >= orderedQuantity + currQuantity;
}

export async function getActiveOrders(
  restaurantIds: string[],
  deliveryDates: Date[]
): Promise<ActiveOrder[]> {
  try {
    const activeOrders = await Order.find({
      status: 'PROCESSING',
      'delivery.date': { $in: deliveryDates },
      'restaurant._id': { $in: restaurantIds },
    })
      .select('delivery.date restaurant._id item.quantity')
      .lean();
    return activeOrders;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export function updateScheduleStatus(
  restaurantIds: string[],
  deliveryDates: Date[],
  upcomingRestaurants: {
    _id: Types.ObjectId;
    scheduledOn: Date;
    orderCapacity: number;
  }[],
  milliseconds = 1
) {
  setTimeout(async () => {
    try {
      const activeOrders = await getActiveOrders(restaurantIds, deliveryDates);
      for (const upcomingRestaurant of upcomingRestaurants) {
        let totalQuantity = 0;
        for (const activeOrder of activeOrders) {
          if (
            dateToMS(activeOrder.delivery.date) ===
              dateToMS(upcomingRestaurant.scheduledOn) &&
            activeOrder.restaurant._id.toString() ===
              upcomingRestaurant._id.toString()
          ) {
            totalQuantity += activeOrder.item.quantity;
          }
        }

        if (totalQuantity >= upcomingRestaurant.orderCapacity) {
          await Restaurant.findByIdAndUpdate(
            upcomingRestaurant._id,
            {
              $set: {
                'schedules.$[schedule].status': 'INACTIVE',
              },
            },
            {
              arrayFilters: [
                { 'schedule.date': upcomingRestaurant.scheduledOn },
              ],
            }
          ).orFail();
        }
      }
    } catch (err) {
      console.log(err);
    }
  }, milliseconds);
}

export async function createOrders(
  res: Response,
  orderData: OrderType[],
  role: UserRole,
  discountCodeId?: string,
  discountAmount?: number
) {
  try {
    const orders = await Order.insertMany(orderData);
    const ordersForCustomer = orders.map((order) => ({
      _id: order._id,
      item: order.item,
      status: order.status,
      createdAt: order.createdAt,
      restaurant: order.restaurant,
      delivery: {
        date: order.delivery.date,
      },
      isReviewed: order.isReviewed,
      company: { shift: order.company.shift },
    }));
    if (discountAmount) {
      await DiscountCode.updateOne(
        { _id: discountCodeId },
        {
          $inc: {
            totalRedeem: 1,
          },
        }
      );
    }
    res.status(201).json(role === 'CUSTOMER' ? ordersForCustomer : orders);
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export function getFutureDate(dayToAdd: number) {
  const today = new Date();
  const sunday = today.getUTCDate() - today.getUTCDay();
  const futureDate = today.setUTCDate(sunday + dayToAdd);
  return new Date(futureDate).setUTCHours(0, 0, 0, 0);
}

export function docToObj<T extends Document>(input: T) {
  return {
    ...input.toObject(),
    _id: (input._id as Types.ObjectId).toString(),
  };
}
