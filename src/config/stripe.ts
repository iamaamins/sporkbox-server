import Stripe from "stripe";
import dotenv from "dotenv";
import { IStripePayableItems } from "../types";

//Configure dot env
dotenv.config();

// Create stripe instance
export const stripe = new Stripe(process.env.STRIPE_TEST_KEY as string, {
  apiVersion: "2022-11-15",
});

// Create stripe checkout session
export async function stripeCheckout(
  customerEmail: string,
  pendingId: string,
  payableItems: IStripePayableItems[]
) {
  try {
    // Create a session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: payableItems.map((payableItem) => {
        return {
          price_data: {
            currency: "usd",
            product_data: {
              name: payableItem.date,
            },
            unit_amount: Math.round(Math.abs(payableItem.amount) * 100),
          },
          quantity: 1,
        };
      }),
      metadata: { pendingId },
      customer_email: customerEmail,
      success_url: `${process.env.CLIENT_URL}/success?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}`,
    });

    // Return the session url
    return session;
  } catch (err) {
    // If session fails to create
    throw err;
  }
}
