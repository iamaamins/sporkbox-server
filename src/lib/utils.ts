import sharp from 'sharp';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import Order from '../models/order';
import { CronJob } from 'cron';
import User from '../models/user';
import mail from '@sendgrid/mail';
import Restaurant from '../models/restaurant';
import { invalidShift } from './messages';
import DiscountCode from '../models/discountCode';
import { Addons, DateTotal, Order as OrderType, UserCompany } from '../types';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { fridayOrderReminder, thursdayOrderReminder } from './emails';

type SortScheduledRestaurant = {
  schedule: {
    date: Date;
  };
};

type OrderReminder = (email: string) => {
  to: string;
  from: string;
  subject: string;
  html: string;
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

export const now = Date.now();

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
      schedules: {
        $elemMatch: {
          date: { $gte: now },
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
          dateToMS(schedule.date) >= now &&
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

export const subscriptions = {
  orderReminder: true,
};

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
  orders: OrderType[],
  discountCodeId?: string,
  discountAmount?: number
) {
  try {
    const response = await Order.insertMany(orders);
    const ordersForCustomers = response.map((order) => ({
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
    res.status(201).json(ordersForCustomers);
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

export async function sendOrderReminderEmails(orderReminder: OrderReminder) {
  const nextWeekMonday = getFutureDate(8);
  const followingWeekSunday = getFutureDate(14);

  try {
    const customers = await User.find({
      role: 'CUSTOMER',
      status: 'ACTIVE',
      'subscribedTo.orderReminder': true,
    })
      .select('companies email')
      .lean();
    const restaurants = await Restaurant.find({
      schedules: {
        $elemMatch: {
          status: 'ACTIVE',
          date: { $gte: nextWeekMonday, $lte: followingWeekSunday },
        },
      },
    })
      .select('schedules')
      .lean();
    const upcomingOrders = await Order.find({
      'delivery.date': { $gte: nextWeekMonday, $lte: followingWeekSunday },
    })
      .select('customer')
      .lean();

    let companies = [];
    for (const restaurant of restaurants) {
      for (const schedule of restaurant.schedules) {
        if (
          schedule.status === 'ACTIVE' &&
          dateToMS(schedule.date) >= nextWeekMonday &&
          dateToMS(schedule.date) <= followingWeekSunday
        ) {
          companies.push(schedule.company._id);
        }
      }
    }
    const emails = [];
    for (const customer of customers) {
      if (
        !upcomingOrders.some(
          (order) => order.customer._id.toString() === customer._id.toString()
        ) &&
        companies.some((el) =>
          customer.companies.some(
            (company) => company._id.toString() === el.toString()
          )
        )
      ) {
        emails.push(customer.email);
      }
    }
    await Promise.all(
      emails.map(async (email) => await mail.send(orderReminder(email)))
    );
    console.log(`Order reminder sent to ${emails.length} customers`);
  } catch (err) {
    console.log(err);
  }
}

async function createPopularItems() {
  try {
    const restaurants = await Restaurant.find().lean().orFail();

    const prevMonth = new Date().getMonth() - 1;
    for (const restaurant of restaurants) {
      const topItems = [];
      for (const item of restaurant.items) {
        const orderCount = await Order.count({
          'item._id': item._id,
          createdAt: { $gte: new Date().setMonth(prevMonth) },
        });
        // Update: threshold
        if (orderCount > 1) {
          topItems.push({ id: item._id.toString(), count: orderCount });
        }
      }
      if (topItems.length > 0) {
        const top3Items = topItems
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);

        const isPopularItem = (itemId: string) =>
          top3Items.some((topItem) => topItem.id === itemId);
        const getPopularityIndex = (itemId: string) =>
          top3Items.findIndex((topItem) => topItem.id === itemId) + 1;

        const updatedItems = restaurant.items.map((item) => {
          const itemId = item._id.toString();
          const { popularityIndex, ...rest } = item;
          if (!isPopularItem(itemId)) return rest;
          return {
            ...rest,
            popularityIndex: getPopularityIndex(itemId),
          };
        });

        await Restaurant.updateOne(
          { _id: restaurant._id },
          { $set: { items: updatedItems } }
        );
      }
    }
  } catch (err) {
    console.log(err);
  }
}

// Send the reminder at Thursday 2 PM
new CronJob(
  '0 0 14 * * Thu',
  async () => {
    await sendOrderReminderEmails(thursdayOrderReminder);
  },
  null,
  true,
  'America/Los_Angeles'
);

// Send the reminder at Friday 8 AM
new CronJob(
  '0 0 8 * * Fri',
  async () => {
    await sendOrderReminderEmails(fridayOrderReminder);
  },
  null,
  true,
  'America/Los_Angeles'
);

// Update popular items
// 0 0 0 1 * * - First day of every month
new CronJob(
  '0 0 0 19 * *',
  async () => {
    await createPopularItems();
  },
  null,
  true,
  'America/Los_Angeles'
);
