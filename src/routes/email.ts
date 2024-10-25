import { Router } from 'express';
import auth from '../middleware/auth';
import User from '../models/user';
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
    await Promise.all(
      customers.map(async (customer) => await mail.send(timeToOrder(customer)))
    );
    res.status(200).json({ message: 'Order reminders sent' });
  } catch (err) {
    console.log(err);
    throw err;
  }
});

export default router;
