import { Router } from 'express';
import auth from '../middleware/auth';
import User from '../models/user';
import Order from '../models/order';
import { unAuthorized } from '../lib/messages';
import mail from '@sendgrid/mail';
import { timeToOrder } from '../lib/emails';

const router = Router();

router.post('/time-to-order', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { code } = req.body;
  try {
    const lastMonth = new Date().getMonth() - 1;
    const orders = await Order.find({
      status: 'DELIVERED',
      'company.code': code,
      createdAt: {
        $gte: new Date().setMonth(lastMonth),
      },
    })
      .select('customer._id')
      .lean();

    const orderMap: Record<string, boolean> = {};
    for (const order of orders) {
      const customerId = order.customer._id.toString();
      if (!orderMap[customerId]) orderMap[customerId] = true;
    }

    const customers = await User.find({
      role: 'CUSTOMER',
      status: 'ACTIVE',
      'subscribedTo.orderReminder': true,
      companies: {
        $elemMatch: { code },
      },
    })
      .select('email firstName')
      .lean();

    const eligibleCustomers = customers.filter(
      (customer) => orderMap[customer._id.toString()]
    );
    await Promise.all(
      eligibleCustomers.map(
        async (eligibleCustomer) =>
          await mail.send(timeToOrder(eligibleCustomer))
      )
    );
    res.status(200).json({ message: 'Order reminders sent' });
  } catch (err) {
    console.log(err);
    throw err;
  }
});

export default router;
