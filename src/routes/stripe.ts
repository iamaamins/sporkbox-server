import Stripe from 'stripe';
import { Router } from 'express';
import Order from '../models/order';
import { stripe } from '../config/stripe';
import authUser from '../middleware/auth';
import DiscountCode from '../models/discountCode';

// Initialize router
const router = Router();

// Event webhook
router.post('/webhook', async (req, res) => {
  // Parsed body
  const parsedBody = JSON.parse(req.body);

  // Parsed metadata details
  const parsedMetadataDetails = JSON.parse(
    parsedBody.data.object.metadata.details
  );

  // Check if the company is sporkbox
  const isSporkBox = parsedMetadataDetails.company === 'sporkbox';

  // Get pending order id
  const pendingOrderId = parsedMetadataDetails.pendingOrderId;

  // Get discount code id and amount
  const discountCodeId = parsedMetadataDetails.discountCodeId;
  const discountAmount = parsedMetadataDetails.discountAmount;

  // Signature
  const signature = req.headers['stripe-signature'] as string;

  try {
    // Product event config
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    // Handle the event
    if (event.type === 'checkout.session.completed' && isSporkBox) {
      // Get the total paid amount
      const session = event.data.object as Stripe.Checkout.Session;

      try {
        // Update order status
        await Order.updateMany(
          { pendingOrderId, status: 'PENDING' },
          {
            $set: {
              status: 'PROCESSING',
              payment: {
                intent: session.payment_intent,
                amount: (session.amount_total as number) / 100,
              },
            },
            $unset: {
              pendingOrderId,
            },
          }
        );

        // Update total redeem amount
        +discountAmount > 0 &&
          (await DiscountCode.updateOne(
            { _id: discountCodeId },
            {
              $inc: {
                totalRedeem: 1,
              },
            }
          ));

        // Send the response
        res.status(201).json('Orders status updated');
      } catch (err) {
        // If order status update fails
        console.log(err);

        throw err;
      }
    } else if (event.type === 'checkout.session.expired' && isSporkBox) {
      try {
        // Delete pending order
        await Order.deleteMany({ pendingOrderId, status: 'PENDING' });

        // Send the response
        res.status(201).json('Orders deleted');
      } catch (err) {
        // If orders aren't deleted
        console.log(err);

        throw err;
      }
    }
  } catch (err) {
    // If event fails to create
    console.log('Stripe event verification failed');
    throw err;
  }
});

// Get session details
router.get('/session/:sessionId', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    if (role === 'CUSTOMER') {
      // Destructure data from req
      const { sessionId } = req.params;

      try {
        // Get session details
        const response = await stripe.checkout.sessions.retrieve(sessionId);

        // Send data with response
        res.status(200).json(response.amount_total);
      } catch (err) {
        // If session retrieval fails
        console.log(err);

        throw err;
      }
    } else {
      // If role isn't customer
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

export default router;
