import { Router } from 'express';
import Order from '../models/order';
import { ItemStat, OrderStat } from '../types';
import authUser from '../middleware/authUser';
import { dateToMS } from '../utils';

const router = Router();

async function getDeliveredOrders() {
  try {
    const orders = await Order.find({
      status: 'DELIVERED',
      'company._id': {
        $in: ['643dec49e88d25d4249723ef', '643e162fe88d25d424972a55'],
      },
      'delivery.date': {
        $gte: '2023-01-01',
        $lte: '2023-12-31',
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

router.get('/order', authUser, async (req, res) => {
  if (req.user) {
    // Get user role
    const { role } = req.user;

    if (role === 'ADMIN') {
      // Get all delivered orders
      const orders = await getDeliveredOrders();

      // Create results
      const results = orders.reduce((acc, curr) => {
        if (
          !acc.some(
            (order) => order.restaurant.id === curr.restaurant._id.toString()
          )
        ) {
          return [
            ...acc,
            {
              restaurant: {
                id: curr.restaurant._id.toString(),
                name: curr.restaurant.name,
              },
              quantity: curr.item.quantity,
            },
          ];
        } else {
          return acc.map((order) => {
            if (order.restaurant.id === curr.restaurant._id.toString()) {
              return {
                ...order,
                quantity: order.quantity + curr.item.quantity,
              };
            } else {
              return order;
            }
          });
        }
      }, [] as OrderStat[]);

      // Return the response
      res.status(200).json(results);
    } else {
      // If role isn't admin
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

router.get('/item', authUser, async (req, res) => {
  if (req.user) {
    // Get role
    const { role } = req.user;

    if (role === 'ADMIN') {
      // Get all delivered orders
      const orders = await getDeliveredOrders();

      // Create results
      const results = orders.reduce((acc, curr) => {
        if (
          !acc.some(
            (order) =>
              order.item.id === curr.item._id.toString() &&
              order.restaurant.id === curr.restaurant._id.toString()
          )
        ) {
          return [
            ...acc,
            {
              restaurant: {
                id: curr.restaurant._id.toString(),
                name: curr.restaurant.name,
              },
              item: {
                id: curr.item._id.toString(),
                name: curr.item.name,
                quantity: curr.item.quantity,
              },
            },
          ];
        } else {
          return acc.map((order) => {
            if (
              order.item.id === curr.item._id.toString() &&
              order.restaurant.id === curr.restaurant._id.toString()
            ) {
              return {
                ...order,
                item: {
                  ...order.item,
                  quantity: order.item.quantity + curr.item.quantity,
                },
              };
            } else {
              return order;
            }
          });
        }
      }, [] as ItemStat[]);

      // Return results
      res.status(200).json(results);
    } else {
      // If role isn't admin
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

router.get('/people', authUser, async (req, res) => {
  if (req.user) {
    const { role } = req.user;

    if (role === 'ADMIN') {
      const orders = await getDeliveredOrders();

      // Number of unique customers served on each day
      const results = orders.reduce((acc, curr) => {
        const currCustomerId = curr.customer._id.toString();
        const currDeliveryDate = dateToMS(curr.delivery.date);

        if (!acc.some((el) => el.date === currDeliveryDate)) {
          return [
            ...acc,
            { date: currDeliveryDate, customers: [currCustomerId] },
          ];
        } else {
          return acc.map((el) => {
            if (el.date === currDeliveryDate) {
              return {
                ...el,
                customers: el.customers.includes(currCustomerId)
                  ? el.customers
                  : [...el.customers, currCustomerId],
              };
            } else {
              return el;
            }
          });
        }
      }, [] as { date: number; customers: string[] }[]);

      res.status(200).json(results);
    } else {
      console.log('Not authorized');
      res.status(403);
      throw new Error('Not authorized');
    }
  } else {
    console.log('Not authorized');
    res.status(403);
    throw new Error('Not authorized');
  }
});

export default router;
