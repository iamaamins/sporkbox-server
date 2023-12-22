import { Router } from 'express';
import Order from '../models/order';

const router = Router();

type Restaurant = {
  id: string;
  name: string;
};

type OrderData = {
  restaurant: Restaurant;
  quantity: number;
};

type ItemData = {
  restaurant: Restaurant;
  item: {
    id: string;
    name: string;
    quantity: number;
  };
};

router.get('/order', async (req, res) => {
  // Get all delivered orders
  const orders = await Order.find({ status: 'DELIVERED' }).lean().orFail();

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
          return { ...order, quantity: order.quantity + curr.item.quantity };
        } else {
          return order;
        }
      });
    }
  }, [] as OrderData[]);

  // Return the response
  res.status(200).json(results);
});

router.get('/item', async (req, res) => {
  // Get all delivered orders
  const orders = await Order.find({ status: 'DELIVERED' }).lean().orFail();

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
  }, [] as ItemData[]);

  // Return results
  res.status(200).json(results);
});

export default router;
