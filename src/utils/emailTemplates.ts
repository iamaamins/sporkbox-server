import { IOrder } from "../types";

export function orderDeliveryTemplate(order: IOrder) {
  return {
    to: order.customer.email,
    from: process.env.SENDER_EMAIL as string,
    subject: `Order Status Update`,
    html: `
        <p>Hi ${order.customer.firstName} ${order.customer.lastName}, your Sporkbox order of ${order.item.name} from ${order.restaurant.name} is delivered now! Please collect from the reception point.</p>
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
