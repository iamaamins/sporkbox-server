import Order from '../models/order';
import authUser from '../middleware/auth';
import { Router } from 'express';
import {
  sortIngredients,
  dateToMS,
  dateToText,
  toUSNumber,
  generateRandomString,
  getUpcomingRestaurants,
  getDateTotal,
  createAddons,
  getAddonsPrice,
} from '../lib/utils';
import {
  orderArchiveTemplate,
  orderDeliveryTemplate,
} from '../lib/emailTemplates';
import mail from '@sendgrid/mail';
import { stripeCheckout } from '../config/stripe';
import DiscountCode from '../models/discountCode';
import { OrdersPayload } from '../types';

// Types
interface OrdersStatusPayload {
  orderIds: string[];
}

// Initialize router
const router = Router();

// Get customer's all upcoming orders
router.get('/me/upcoming-orders', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data from req
    const { _id, role } = req.user;

    if (role === 'CUSTOMER') {
      try {
        // Find the upcoming orders of the customer
        const allUpcomingOrders = await Order.find({
          'customer._id': _id,
          status: 'PROCESSING',
        })
          .sort({ 'delivery.date': 1 })
          .select(
            '-__v -updatedAt -customer -delivery.address -company.name -company._id'
          );

        // Send the data with response
        res.status(200).json(allUpcomingOrders);
      } catch (err) {
        // If upcoming orders aren't fetched successfully
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

// Get customer's limited delivered orders
router.get('/me/delivered-orders/:limit', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data from req
    const { role, _id } = req.user;

    if (role === 'CUSTOMER') {
      // Destructure req data
      const { limit } = req.params;

      // If all the fields aren't provided
      if (!limit) {
        // Log error
        console.log('Please provide all the fields');

        res.status(400);
        throw new Error('Please provide all the fields');
      }

      try {
        // Find the delivered orders of the customer
        const customerDeliveredOrders = await Order.find({
          'customer._id': _id,
          status: 'DELIVERED',
        })
          .limit(+limit)
          .sort({ 'delivery.date': -1 })
          .select(
            '-__v -updatedAt -customer -delivery.address -company.name -company._id'
          );

        // Send the data with response
        res.status(200).json(customerDeliveredOrders);
      } catch (err) {
        // If delivered orders aren't fetched successfully
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

// Create orders
router.post('/create-orders', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data from req
    const { _id, firstName, lastName, email, role, companies } = req.user;

    if (role === 'CUSTOMER' && companies && companies.length > 0) {
      // Get data from req user and body
      const { items, discountCodeId }: OrdersPayload = req.body;

      // If required data aren't provided
      if (
        !items ||
        !items.every(
          (item) =>
            item.itemId &&
            item.quantity &&
            item.companyId &&
            item.restaurantId &&
            item.deliveryDate &&
            item.optionalAddons &&
            item.requiredAddons
        )
      ) {
        // Log error
        console.log('Please provide valid orders data');

        res.status(401);
        throw new Error('Please provide valid orders data');
      }

      // Get upcoming week restaurants
      // to validate the orders,
      // to get the order item details, and
      // to get scheduled dates and company ids
      const upcomingRestaurants = await getUpcomingRestaurants(companies);

      // Check if the provided order items are valid
      const orderItemsAreValid = items.every((orderPayload) =>
        upcomingRestaurants.some(
          (upcomingRestaurant) =>
            upcomingRestaurant._id.toString() === orderPayload.restaurantId &&
            upcomingRestaurant.company._id.toString() ===
              orderPayload.companyId &&
            dateToMS(upcomingRestaurant.date) === orderPayload.deliveryDate &&
            upcomingRestaurant.items.some(
              (item) =>
                item._id?.toString() === orderPayload.itemId &&
                (orderPayload.optionalAddons.length > 0
                  ? item.optionalAddons.addable >=
                      orderPayload.optionalAddons.length &&
                    orderPayload.optionalAddons.every((orderOptionalAddon) =>
                      item.optionalAddons.addons
                        .split(',')
                        .some(
                          (itemOptionalAddon) =>
                            itemOptionalAddon.split('-')[0].trim() ===
                            orderOptionalAddon
                              .split('-')[0]
                              .trim()
                              .toLowerCase()
                        )
                    )
                  : true) &&
                (orderPayload.requiredAddons.length > 0
                  ? item.requiredAddons.addable ===
                      orderPayload.requiredAddons.length &&
                    orderPayload.requiredAddons.every((orderRequiredAddon) =>
                      item.requiredAddons.addons
                        .split(',')
                        .some(
                          (itemRequiredAddon) =>
                            itemRequiredAddon.split('-')[0].trim() ===
                            orderRequiredAddon
                              .split('-')[0]
                              .trim()
                              .toLowerCase()
                        )
                    )
                  : true) &&
                (orderPayload.removedIngredients.length > 0
                  ? orderPayload.removedIngredients.every((removedIngredient) =>
                      item.removableIngredients
                        .split(',')
                        .some(
                          (removableIngredient) =>
                            removableIngredient.trim() ===
                            removedIngredient.trim().toLowerCase()
                        )
                    )
                  : true)
            )
        )
      );

      // If items are not valid
      if (!orderItemsAreValid) {
        // Log error
        console.log('Orders are not valid');

        res.status(400);
        throw new Error('Orders are not valid');
      }

      // Create orders
      const orders = items.map((orderPayload) => {
        // Find the restaurant
        const restaurant = upcomingRestaurants.find(
          (upcomingRestaurant) =>
            upcomingRestaurant._id.toString() === orderPayload.restaurantId
        );

        // Find the company
        const company = companies.find(
          (company) => company._id.toString() === orderPayload.companyId
        );

        if (restaurant && company) {
          // Find the item
          const item = restaurant.items.find(
            (item) => item._id?.toString() === orderPayload.itemId
          );

          // Get optional addons
          const optionalAddons = createAddons(orderPayload.optionalAddons);

          // Get required addons
          const requiredAddons = createAddons(orderPayload.requiredAddons);

          if (item) {
            // Get optional addons price total
            const optionalAddonsPrice = getAddonsPrice(
              item.optionalAddons.addons,
              optionalAddons
            );

            // Get required addons price total
            const requiredAddonsPrice = getAddonsPrice(
              item.requiredAddons.addons,
              requiredAddons
            );

            // Get total addons price
            const totalAddonsPrice =
              (optionalAddonsPrice || 0) + (requiredAddonsPrice || 0);

            // Create and return individual order
            return {
              customer: {
                _id: _id,
                firstName,
                lastName,
                email,
              },
              restaurant: {
                _id: orderPayload.restaurantId,
                name: restaurant.name,
              },
              company: {
                _id: company._id,
                name: company.name,
                shift: company.shift,
              },
              delivery: {
                date: orderPayload.deliveryDate,
                address: {
                  city: company.address.city,
                  state: company.address.state,
                  zip: company.address.zip,
                  addressLine1: company.address.addressLine1,
                  addressLine2: company.address.addressLine2,
                },
              },
              status: 'PROCESSING',
              item: {
                _id: orderPayload.itemId,
                name: item.name,
                tags: item.tags,
                description: item.description,
                quantity: orderPayload.quantity,
                image: item.image || restaurant.logo,
                optionalAddons: optionalAddons.sort(sortIngredients).join(', '),
                requiredAddons: requiredAddons.sort(sortIngredients).join(', '),
                removedIngredients: orderPayload.removedIngredients
                  .sort(sortIngredients)
                  .join(', '),
                total: toUSNumber(
                  (item.price + totalAddonsPrice) * orderPayload.quantity
                ),
              },
            };
          } else {
            // If item isn't found
            // Log error
            console.log('Item is not found');

            res.status(400);
            throw new Error('Item is not found');
          }
        } else {
          // If restaurant isn't found
          console.log('Restaurant or company is not found');

          res.status(400);
          throw new Error('Restaurant or company is not found');
        }
      });

      try {
        // Get unique upcoming dates and company ids
        // Dates will be used to get the upcoming orders
        const upcomingDetails = upcomingRestaurants
          .map((upcomingRestaurant) => ({
            date: dateToMS(upcomingRestaurant.date),
            companyId: upcomingRestaurant.company._id,
          }))
          .filter(
            (detail, index, details) =>
              details.findIndex(
                (el) =>
                  el.date === detail.date && el.companyId === detail.companyId
              ) === index
          );

        // Get customer upcoming orders
        const upcomingOrders = await Order.find({
          'customer._id': _id,
          status: {
            $nin: ['PENDING', 'ARCHIVED'],
          },
          'delivery.date': {
            $gte: Math.min(
              ...upcomingDetails.map((upcomingDetail) => upcomingDetail.date)
            ),
          },
        })
          .select('delivery item company')
          .lean();

        // Get upcoming orders that matches order item dates
        const upcomingDateTotalDetails = upcomingOrders
          .filter((upcomingOrder) =>
            orders.some(
              (order) =>
                order.delivery.date === dateToMS(upcomingOrder.delivery.date) &&
                order.company._id.toString() ===
                  upcomingOrder.company._id.toString()
            )
          )
          .map((upcomingOrder) => ({
            total: upcomingOrder.item.total,
            shift: upcomingOrder.company.shift,
            date: dateToMS(upcomingOrder.delivery.date),
            companyId: upcomingOrder.company._id.toString(),
          }));

        // Get upcoming order date and total
        // with shift and company id details
        const upcomingOrderDetails = getDateTotal(upcomingDateTotalDetails);

        // Create order date total details
        const orderDateTotalDetails = orders.map((order) => ({
          shift: order.company.shift,
          date: order.delivery.date,
          total: order.item.total,
          companyId: order.company._id.toString(),
        }));

        // Get order date and total with
        // shift and company id details
        const orderItemDetails = getDateTotal(orderDateTotalDetails);

        // Find the active company
        const company = companies.find(
          (company) => company.status === 'ACTIVE'
        );

        // Get shift budget
        const shiftBudget = company?.shiftBudget || 0;

        // Get payable details
        const payableDetails = orderItemDetails
          .map((orderItemDetail) => {
            // Destructure data
            const { total, ...rest } = orderItemDetail;

            if (
              !upcomingOrderDetails.some(
                (upcomingOrderDetail) =>
                  upcomingOrderDetail.date === orderItemDetail.date
              )
            ) {
              return {
                ...rest,
                payable: orderItemDetail.total - shiftBudget,
              };
            } else {
              // Get upcoming order date and total detail
              const upcomingOrderDetail = upcomingOrderDetails.find(
                (upcomingOrderDetail) =>
                  upcomingOrderDetail.date === orderItemDetail.date
              );

              // Get order total for the day
              const upcomingDayOrderTotal = upcomingOrderDetail?.total || 0;

              return {
                ...rest,
                payable:
                  upcomingDayOrderTotal >= shiftBudget
                    ? orderItemDetail.total
                    : orderItemDetail.total -
                      (shiftBudget - upcomingDayOrderTotal),
              };
            }
          })
          .filter((detail) => detail.payable > 0);

        // Initial discount value
        let discountAmount = 0;

        if (discountCodeId && payableDetails.length > 0) {
          // Get the discount details
          const discountCode = await DiscountCode.findById(discountCodeId)
            .select('value redeemability totalRedeem')
            .lean()
            .orFail();

          // Redeemability
          const redeemability = discountCode.redeemability;

          // Check redeemability
          if (
            redeemability === 'unlimited' ||
            (redeemability === 'once' && discountCode.totalRedeem < 1)
          ) {
            // Update discount amount
            discountAmount = discountCode.value;
          }
        }

        // Get total payable amount
        const totalPayableAmount = payableDetails.reduce(
          (acc, curr) => acc + curr.payable,
          0
        );

        // Check if there is an amount to pay
        const hasPayableItems = totalPayableAmount > discountAmount;

        if (hasPayableItems) {
          // Create payable orders
          const payableOrders = payableDetails.map((payableDetail) => ({
            date: `${dateToText(
              payableDetail.date
            )} - ${`${payableDetail.shift[0].toUpperCase()}${payableDetail.shift.slice(
              1
            )}`}`,
            items: orders
              .filter(
                (order) =>
                  order.delivery.date === payableDetail.date &&
                  order.company._id.toString() === payableDetail.companyId
              )
              .map((order) => order.item.name),
            amount:
              payableDetail.payable - discountAmount / payableDetails.length,
          }));

          // Create random pending Id
          const pendingOrderId = generateRandomString();

          // Create stripe checkout sessions
          const session = await stripeCheckout(
            email,
            pendingOrderId,
            discountCodeId,
            discountAmount,
            payableOrders
          );

          // Create pending orders
          const pendingOrders = orders.map((order) => ({
            ...order,
            pendingOrderId,
            status: 'PENDING',
          }));

          // Create orders
          await Order.insertMany(pendingOrders);

          // Send the session url with response
          res.status(200).json(session.url);
        } else {
          // Create orders
          const response = await Order.insertMany(orders);

          // Format orders for customer
          const ordersForCustomers = response.map((order) => ({
            _id: order._id,
            item: order.item,
            status: order.status,
            createdAt: order.createdAt,
            restaurant: order.restaurant,
            delivery: {
              date: order.delivery.date,
            },
            hasReviewed: order.hasReviewed,
            company: { shift: order.company.shift },
          }));

          // Update total redeem amount
          discountAmount > 0 &&
            (await DiscountCode.updateOne(
              { _id: discountCodeId },
              {
                $inc: {
                  totalRedeem: 1,
                },
              }
            ));

          // Send the data with response
          res.status(201).json(ordersForCustomers);
        }
      } catch (err) {
        // Log error
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

// Get all upcoming orders
router.get('/all-upcoming-orders', authUser, async (req, res) => {
  if (req.user) {
    // Get data from req user
    const { role } = req.user;

    if (role === 'ADMIN') {
      try {
        // Find the upcoming orders
        const upcomingOrders = await Order.find({ status: 'PROCESSING' })
          .select('-__v -updatedAt')
          .sort({ 'delivery.date': 1 });

        // Send the data with response
        res.status(200).json(upcomingOrders);
      } catch (err) {
        // If upcoming orders aren't fetched successfully
        console.log(err);

        throw err;
      }
    } else {
      // If role isn't admin
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

// Get limited delivered orders
router.get('/all-delivered-orders/:limit', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    if (role === 'ADMIN') {
      // Destructure data from req
      const { limit } = req.params;

      // If all the fields aren't provided
      if (!limit) {
        // Log error
        console.log('Please provide all the fields');

        res.status(400);
        throw new Error('Please provide all the fields');
      }

      try {
        // Get delivered orders
        const deliveredOrders = await Order.find({ status: 'DELIVERED' })
          .limit(+limit)
          .select('-__v -updatedAt')
          .sort({ 'delivery.date': -1 });

        // Send delivered orders with response
        res.status(200).json(deliveredOrders);
      } catch (err) {
        // If delivered orders aren't fetched successfully
        console.log(err);

        throw err;
      }
    } else {
      // If role isn't admin
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

// Get all delivered orders of a customer
router.get('/:customerId/all-delivered-orders', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    if (role === 'ADMIN') {
      // Destructure data from req
      const { customerId } = req.params;

      try {
        const customerDeliveredOrders = await Order.find({
          'customer._id': customerId,
          status: 'DELIVERED',
        })
          .sort({ 'delivery.date': -1 })
          .select('-__v -updatedAt');

        // Send orders with response
        res.status(200).json(customerDeliveredOrders);
      } catch (err) {
        // If orders aren't found
        console.log(err);

        throw err;
      }
    } else {
      // If role isn't admin
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

// Change bulk orders and send delivery email
router.patch('/change-orders-status', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    if (role === 'ADMIN') {
      // Destructure data from req
      const { orderIds }: OrdersStatusPayload = req.body;

      // If order ids aren't provides
      if (!orderIds) {
        // Log error
        console.log('Please provide order ids');

        res.status(400);
        throw new Error('Please provide order ids');
      }

      try {
        // Update orders status
        await Order.updateMany(
          { _id: { $in: orderIds }, status: 'PROCESSING' },
          { $set: { status: 'DELIVERED' } }
        );

        // Find the orders
        const orders = await Order.find({ _id: { $in: orderIds } });

        // Send delivery email
        await Promise.all(
          orders.map(
            async (order) =>
              await mail.send(orderDeliveryTemplate(order.toObject()))
          )
        );

        // Send the update
        res.status(200).json('Delivery email sent');
      } catch (err) {
        // Log error
        console.log(err);

        throw err;
      }
    } else {
      // If role isn't admin
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

// Change single order status
router.patch('/:orderId/change-order-status', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    if (role === 'ADMIN') {
      // Destructure data from req
      const { orderId } = req.params;

      try {
        // Update order status
        const updatedOrder = await Order.findOneAndUpdate(
          { _id: orderId, status: 'PROCESSING' },
          {
            status: 'ARCHIVED',
          },
          { returnDocument: 'after' }
        )
          .select('-__v -updatedAt')
          .orFail();

        // Send cancellation email
        await mail.send(orderArchiveTemplate(updatedOrder.toObject()));

        // Send updated order with the response
        res.status(201).json(updatedOrder);
      } catch (err) {
        // Log error
        console.log(err);

        throw err;
      }
    } else {
      // If role isn't admin
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

export default router;
