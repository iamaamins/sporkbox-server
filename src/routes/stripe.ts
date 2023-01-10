import Order from "../models/order";
import { stripe } from "../config/stripe";
import authUser from "../middleware/authUser";
import express, { Request, Response } from "express";

// Initialize router
const router = express.Router();

// Event webhook
router.post("/webhook", async (req: Request, res: Response) => {
  // Parsed body
  const parsedBody = JSON.parse(req.body);

  // Signature
  const signature = req.headers["stripe-signature"] as string;

  try {
    // Product event config
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    // Handle the event
    if (event.type === "checkout.session.completed") {
      // Get pending id
      const pendingId = parsedBody.data.object.metadata.pendingId;

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
      const pendingId = parsedBody.data.object.metadata.pendingId;

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
  } catch (err) {
    // If event fails to create
    console.log("Stripe event verification failed");
    throw err;
  }
});

// Get session details
router.get(
  "/session/:sessionId",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "CUSTOMER") {
        // Destructure data from req
        const { sessionId } = req.params;

        try {
          // Get session details
          const response = await stripe.checkout.sessions.retrieve(sessionId);

          // Send data with response
          res.status(200).json(response.amount_total);
        } catch (err) {
          // If session retrieval fails
          throw err;
        }
      } else {
        // If role isn't customer
        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

export default router;
