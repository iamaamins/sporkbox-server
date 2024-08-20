import { Router } from 'express';
import Order from '../models/order';
import auth from '../middleware/auth';
import { dateToMS } from '../lib/utils';
import { unAuthorized } from '../lib/messages';
import Restaurant from '../models/restaurant';
import { CustomerStat, ItemStat, OrderStat } from '../types';

const router = Router();

async function getDeliveredOrders() {
  const newDate = new Date();
  const year = newDate.getFullYear();
  const month = `${newDate.getMonth() + 1}`.padStart(2, '0');
  const date = `${newDate.getDate()}`.padStart(2, '0');

  const from = `${year}-01-01`;
  const to = `${year}-${month}-${date}`;

  try {
    const orders = await Order.find({
      status: 'DELIVERED',
      'company._id': {
        $in: ['643dec49e88d25d4249723ef', '643e162fe88d25d424972a55'],
      },
      'delivery.date': {
        $gte: from,
        $lte: to,
      },
    })
      .lean()
      .orFail();

    return orders;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

router.get('/order', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const orders = await getDeliveredOrders();
  const resultsMap: Record<string, OrderStat> = {};
  for (const order of orders) {
    const key = order.restaurant._id.toString();
    if (!resultsMap[key]) {
      resultsMap[key] = {
        restaurant: {
          id: order.restaurant._id.toString(),
          name: order.restaurant.name,
        },
        quantity: order.item.quantity,
      };
    } else {
      resultsMap[key].quantity += order.item.quantity;
    }
  }
  res.status(200).json(Object.values(resultsMap));
});

router.get('/item', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const orders = await getDeliveredOrders();
  const resultsMap: Record<string, ItemStat> = {};
  for (const order of orders) {
    const key = `${order.item._id}${order.restaurant._id}`;
    if (!resultsMap[key]) {
      resultsMap[key] = {
        restaurant: {
          id: order.restaurant._id.toString(),
          name: order.restaurant.name,
        },
        item: {
          id: order.item._id.toString(),
          name: order.item.name,
          quantity: order.item.quantity,
        },
      };
    } else {
      resultsMap[key].item.quantity += order.item.quantity;
    }
  }
  res.status(200).json(Object.values(resultsMap));
});

router.get('/people', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const orders = await getDeliveredOrders();
  const resultsMap: Record<string, CustomerStat> = {};
  for (const order of orders) {
    const customerId = order.customer._id.toString();
    const deliveryDate = dateToMS(order.delivery.date);

    if (!resultsMap[deliveryDate]) {
      resultsMap[deliveryDate] = {
        date: deliveryDate,
        customers: [customerId],
      };
    } else {
      if (!resultsMap[deliveryDate].customers.includes(customerId))
        resultsMap[deliveryDate].customers.push(customerId);
    }
  }
  res.status(200).json(Object.values(resultsMap));
});

router.get('/restaurant-items', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const restaurants = await Restaurant.find().lean().orFail();
    const items = [];
    for (const restaurant of restaurants) {
      for (const item of restaurant.items) {
        if (item.status === 'ACTIVE') {
          items.push({
            restaurant: restaurant.name,
            name: item.name,
            price: item.price,
          });
        }
      }
    }
    res.status(200).json(items);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

export default router;
