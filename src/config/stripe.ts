import Stripe from 'stripe';
import dotenv from 'dotenv';

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
  customerId: string,
  customerEmail: string,
  pendingOrderId: string,
  discountCodeId: string,
  discountAmount: number,
  ordersPlacedBy: 'ADMIN' | 'COMPANY_ADMIN' | 'SELF',
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
      success_url: `${process.env.CLIENT_URL}/checkout/${customerId}/success?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}${
        ordersPlacedBy === 'SELF'
          ? '/cart'
          : ordersPlacedBy === 'COMPANY_ADMIN'
          ? `/company/${customerId}/cart`
          : `/admin/dashboard/${customerId}/cart`
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
