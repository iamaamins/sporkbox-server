import { IOrder, IUser } from "../types";

export function orderDeliveryTemplate(order: IOrder) {
  return {
    to: order.customer.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Your Meal Has Been Delivered! 🍽️`,
    html: `
        <p>
        Hi ${order.customer.firstName} ${order.customer.lastName}, your Sporkbox order of ${order.item.name} from ${order.restaurant.name} has been delivered! Please be sure to take the meal that is labeled with your name.
        
        Enjoy! 😋

        - The Spork Bytes Team
        </p>
        `,
  };
}

export function orderArchiveTemplate(order: IOrder) {
  return {
    to: order.customer.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Order Status Update`,
    html: `
        <p>Hi ${order.customer.firstName} ${order.customer.lastName}, your Sporkbox order of ${order.item.name} from ${order.restaurant.name} is cancelled. You can reorder for this date now.</p>
        `,
  };
}

export function orderCancelTemplate(order: IOrder) {
  return {
    to: order.customer.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Order Status Update`,
    html: `
        <p>Hi ${order.customer.firstName} ${order.customer.lastName}, your Sporkbox order of ${order.item.name} from ${order.restaurant.name} is cancelled. </p>
        `,
  };
}

export function passwordResetTemplate(user: IUser, link: string) {
  return {
    to: user.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Sporkbox Password Reset`,
    html: `
        <p>Hi ${user.firstName} ${user.lastName}, please reset your password here: ${link}. Please ignore if you haven't requested this change.</p>
        `,
  };
}

export function passwordResetConfirmationTemplate(user: IUser) {
  return {
    to: user.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Sporkbox Password Reset`,
    html: `
        <p>Hi ${user.firstName} ${user.lastName}, your Sporkbox password reset is successful.</p>
        `,
  };
}
