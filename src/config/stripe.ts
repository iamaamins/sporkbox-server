import Stripe from 'stripe';
import dotenv from 'dotenv';
import { UserRole } from '../types';

interface OrdersWithPayment {
  items: string[];
  amount: number;
  dateShift: string;
}

dotenv.config();

export const stripe = new Stripe(process.env.STRIPE_KEY as string, {
  apiVersion: '2022-11-15',
});

export async function stripeCheckout(
  role: UserRole,
  customerEmail: string,
  pendingOrderId: string,
  discountCodeId: string,
  discountAmount: number,
  ordersWithPayment: OrdersWithPayment[]
) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: ordersWithPayment.map((orderWithPayment) => {
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: orderWithPayment.dateShift,
              description: orderWithPayment.items.join(', '),
            },
            unit_amount: Math.round(orderWithPayment.amount * 100),
          },
          quantity: 1,
        };
      }),
      metadata: {
        details: JSON.stringify({
          pendingOrderId,
          discountCodeId,
          discountAmount,
          company: 'sporkbox',
        }),
      },
      customer_email: customerEmail,
      success_url: `${process.env.CLIENT_URL}${
        role === 'CUSTOMER'
          ? '/success?session={CHECKOUT_SESSION_ID}'
          : '/admin/dashboard'
      }`,
      cancel_url: `${process.env.CLIENT_URL}${
        role === 'CUSTOMER' ? '/dashboard' : '/admin/dashboard'
      }`,
    });
    return session;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export async function stripeRefund(amount: number, paymentIntent: string) {
  try {
    await stripe.refunds.create({
      payment_intent: paymentIntent,
      amount: Math.round(amount * 100),
    });
  } catch (err) {
    console.log(err);
    throw err;
  }
}
