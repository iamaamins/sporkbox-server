import Order from "../models/order";
import { stripe } from "../config/stripe";
import express, { Request, Response } from "express";

// Initialize router
const router = express.Router();

// Event webhook
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    // Signature
    const signature = req.headers["stripe-signature"] as string;

    // Create payload
    const payload = JSON.stringify(req.body, null, 2);

    // Create test header
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET as string,
    });

    // Event variable
    let event;

    try {
      // Test event
      event = stripe.webhooks.constructEvent(
        payload,
        header,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );

      // // Production event?
      // event = stripe.webhooks.constructEvent(
      //   req.body,
      //   signature,
      //   process.env.STRIPE_WEBHOOK_SECRET as string
      // );
    } catch (err) {
      // If event fails to create
      console.log("Stripe event verification failed");
      throw err;
    }

    // Handle the event
    if (event.type === "checkout.session.completed") {
      // Get pending id
      const pendingId = req.body.data.object.metadata.pendingId;

      try {
        // Update order status
        await Order.updateMany(
          { pendingId, status: "PENDING" },
          {
            $set: {
              status: "PROCESSING",
            },
            $unset: {
              pendingId,
            },
          }
        );

        // Send the response
        res.status(201).json("Order status updated");
      } catch (err) {
        // If order status update fails
        throw err;
      }
    } else if (event.type === "checkout.session.expired") {
      // Get pending id
      const pendingId = req.body.data.object.metadata.pendingId;

      try {
        // Delete pending order
        await Order.deleteMany({ pendingId, status: "PENDING" });

        // Send the response
        res.status(201).json("Order deleted");
      } catch (err) {
        // If orders aren't deleted
        throw err;
      }
    }
  }
);

export default router;
