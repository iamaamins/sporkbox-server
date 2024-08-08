import { OrderForEmail, GenericUser } from '../types';

export function orderDelivery(order: OrderForEmail) {
  return {
    to: order.customer.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Your Meal Has Been Delivered! 🍽️`,
    html: `
        <p>
        Hi ${order.customer.firstName} ${order.customer.lastName}, your Spork Box order of ${order.item.name} from ${order.restaurant.name} has been delivered! Please be sure to take the meal that is labeled with your name.
        </p>

        <p>Enjoy! 😋 </p>

        <p>Your feedback is important to us. Let us know what you think of your order <a href='${process.env.CLIENT_URL}/dashboard/${order._id}'>here</a>.</p>

        <p>- The Spork Bytes Team</p>
        `,
  };
}

export function orderArchive(order: OrderForEmail) {
  return {
    to: order.customer.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Order Status Update`,
    html: `
        <p>Hi ${order.customer.firstName} ${order.customer.lastName}, your Spork Box order of ${order.item.name} from ${order.restaurant.name} is cancelled. You can reorder for this date now.</p>
        `,
  };
}

export function orderCancel(order: OrderForEmail) {
  return {
    to: order.customer.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Order Status Update`,
    html: `
        <p>Hi ${order.customer.firstName} ${order.customer.lastName}, your Spork Box order of ${order.item.name} from ${order.restaurant.name} is cancelled.</p>
        `,
  };
}

export function passwordReset(user: GenericUser, link: string) {
  return {
    to: user.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Spork Box Password Reset`,
    html: `
        <p>Hi ${user.firstName} ${user.lastName}, please reset your password here: ${link}. Please ignore if you haven't requested this change.</p>
        `,
  };
}

export function passwordResetConfirmation(user: GenericUser) {
  return {
    to: user.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Spork Box Password Reset`,
    html: `
        <p>Hi ${user.firstName} ${user.lastName}, your Spork Box password reset is successful.</p>
        `,
  };
}

export function thursdayOrderReminder(email: string) {
  return {
    to: email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Have you placed your order for lunch next week?`,
    html: `
        <p>Hey there!</p>

        <p>
          <strong>
            Have you placed your order for lunch next week?
          </strong>
        </p>

        <p>Make your meal selections at www.sporkbox.app</p>

        <p>You must complete your selections by <strong>NOON Friday</strong> to lock in your order!</p>

        <p>Thanks!</p>

        <p>- The Spork Bytes Team</p>
        `,
  };
}

export function fridayOrderReminder(email: string) {
  return {
    to: email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Have you placed your order for lunch next week?`,
    html: `
        <p>Hey there!</p>

        <p>
          <strong>
            Have you placed your order for lunch next week?
          </strong>
        </p>

        <p>Make your meal selections at www.sporkbox.app</p>

        <p>You must complete your selections by <strong>NOON TODAY</strong> to lock in your order!</p>

        <p>Thanks!</p>

        <p>- The Spork Bytes Team</p>
        `,
  };
}

export function orderRefund(order: OrderForEmail, amount: number) {
  return {
    to: order.customer.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Order Status Update`,
    html: `
        <p>Hi ${order.customer.firstName} ${
      order.customer.lastName
    }, your Spork Box order of ${order.item.name} from ${
      order.restaurant.name
    } is canceled and $${amount.toFixed(2)} is refunded. </p>
        `,
  };
}
