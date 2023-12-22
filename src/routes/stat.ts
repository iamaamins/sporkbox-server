import { Router } from 'express';
import Order from '../models/order';

const router = Router();

type Order = {
  restaurant: {
    id: string;
    name: string;
  };
  quantity: number;
};

router.get('/total-orders', async (req, res) => {
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
  }, [] as Order[]);

  // Return the response
  res.status(200).json(results);
});

export default router;
