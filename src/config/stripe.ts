import Stripe from "stripe";
import dotenv from "dotenv";

//Configure dot env
dotenv.config();

// Create stripe instance
const stripe = new Stripe(process.env.STRIPE_TEST_KEY as string, {
  apiVersion: "2022-11-15",
});

interface payableItems {
  date: string;
  amount: number;
}

// Create stripe checkout session
export async function stripeCheckout(payableAmounts: payableItems[]) {
  // Create a session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: payableAmounts.map((payableAmount) => {
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: payableAmount.date,
          },
          unit_amount: Math.abs(payableAmount.amount) * 100,
        },
        quantity: 1,
      };
    }),
    success_url: process.env.ROOT_DOMAIN as string,
    cancel_url: `${process.env.ROOT_DOMAIN}/cart`,
  });

  return session.url;
}
