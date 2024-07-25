import Order from '../models/order';
import auth from '../middleware/auth';
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
  getActiveOrders,
  checkOrderCapacity,
  updateRestaurantScheduleStatus,
} from '../lib/utils';
import {
  orderArchiveTemplate,
  orderCancelTemplate,
  orderDeliveryTemplate,
  orderRefundTemplate,
} from '../lib/emailTemplates';
import mail from '@sendgrid/mail';
import {
  stripeCheckout,
  stripeRefund,
  stripeRefundAmount,
} from '../config/stripe';
import { Types } from 'mongoose';
import DiscountCode from '../models/discountCode';
import Restaurant from '../models/restaurant';
import { Discount, OrdersPayload, UpcomingDataMap } from '../types';
import { invalidCredentials, unAuthorized } from '../lib/messages';

type Order = {
  customer: {
    _id: Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
  };
  restaurant: {
    _id: Types.ObjectId;
    name: string;
  };
  company: {
    _id: Types.ObjectId;
    name: string;
    code: string;
    shift: string;
  };
  delivery: {
    date: number;
    address: {
      city: string;
      state: string;
      zip: string;
      addressLine1: string;
      addressLine2?: string;
    };
  };
  discount?: Discount;
  status: 'PENDING' | 'PROCESSING';
  item: {
    _id: Types.ObjectId;
    name: string;
    tags: string;
    description: string;
    quantity: number;
    image: string;
    optionalAddons: string;
    requiredAddons: string;
    removedIngredients: string;
    total: number;
  };
  pendingOrderId?: string;
  payment?: { distributed?: number };
};

const router = Router();

// Get vendor's all upcoming orders
router.get('/vendor/upcoming-orders', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const allUpcomingOrders = await Order.find({
      'restaurant._id': req.user.restaurant,
      status: 'PROCESSING',
    })
      .sort({ 'delivery.date': 1 })
      .select(
        'company.code company.shift delivery.date item._id item.name item.quantity item.optionalAddons item.requiredAddons item.removedIngredients'
      );
    res.status(200).json(allUpcomingOrders);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Get customer's all upcoming orders
router.get('/me/upcoming-orders', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const allUpcomingOrders = await Order.find({
      'customer._id': req.user._id,
      status: 'PROCESSING',
    })
      .sort({ 'delivery.date': 1 })
      .select(
        '-__v -updatedAt -customer -delivery.address -company.name -company._id'
      );
    res.status(200).json(allUpcomingOrders);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Get customer's limited delivered orders
router.get('/me/delivered-orders/:limit', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { limit } = req.params;
  try {
    const customerDeliveredOrders = await Order.find({
      'customer._id': req.user._id,
      status: 'DELIVERED',
    })
      .limit(+limit)
      .sort({ 'delivery.date': -1 })
      .select(
        '-__v -updatedAt -customer -delivery.address -company.name -company._id'
      );
    res.status(200).json(customerDeliveredOrders);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Create orders
router.post('/create-orders', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { _id, firstName, lastName, email, companies } = req.user;
  if (!companies || companies.length === 0) {
    console.log(invalidCredentials);
    res.status(403);
    throw new Error(invalidCredentials);
  }

  const { orderItems, discountCodeId }: OrdersPayload = req.body;
  if (!orderItems || !orderItems.length) {
    console.log('Please provide valid order items');
    res.status(400);
    throw new Error('Please provide valid order items');
  }

  try {
    // Get upcoming week restaurants
    // to validate the orders,
    // to get the order item details, and
    // to get scheduled dates and company ids
    const getActiveSchedules = true;
    const upcomingRestaurants = await getUpcomingRestaurants(
      res,
      companies,
      getActiveSchedules
    );
    const companyIds: string[] = [];
    for (const restaurant of upcomingRestaurants) {
      const companyId = restaurant.company._id.toString();
      if (!companyIds.includes(companyId)) companyIds.push(companyId);
    }
    const deliveryDates: Date[] = [];
    for (const restaurant of upcomingRestaurants) {
      const deliveryDate = restaurant.schedule.date;
      if (!deliveryDates.includes(deliveryDate))
        deliveryDates.push(deliveryDate);
    }
    const restaurantIds: string[] = [];
    for (const restaurant of upcomingRestaurants) {
      const restaurantId = restaurant._id.toString();
      if (!restaurantIds.includes(restaurantId))
        restaurantIds.push(restaurantId);
    }

    // Get active orders for scheduled
    // restaurants with companies and delivery dates
    // to validate order capacity
    const activeOrders = await getActiveOrders(
      companyIds,
      restaurantIds,
      deliveryDates
    );

    // Create data map
    const upcomingDataMap: UpcomingDataMap = {};
    for (const upcomingRestaurant of upcomingRestaurants) {
      const deliveryDate = dateToMS(upcomingRestaurant.schedule.date);
      if (!upcomingDataMap[deliveryDate]) upcomingDataMap[deliveryDate] = {};

      const company = upcomingRestaurant.company._id.toString();
      if (!upcomingDataMap[deliveryDate][company])
        upcomingDataMap[deliveryDate][company] = {};

      const restaurant = upcomingRestaurant._id.toString();
      if (!upcomingDataMap[deliveryDate][company][restaurant])
        upcomingDataMap[deliveryDate][company][restaurant] = {
          item: {},
          orderCapacity: upcomingRestaurant.orderCapacity,
        };

      for (const item of upcomingRestaurant.items) {
        upcomingDataMap[deliveryDate][company][restaurant].item[
          item._id.toString()
        ] = {
          optionalAddons: item.optionalAddons,
          requiredAddons: item.requiredAddons,
          removableIngredients: item.removableIngredients,
        };
      }
    }

    // Validate order items
    for (const orderItem of orderItems) {
      // Validate delivery date
      const isValidDate = upcomingDataMap[orderItem.deliveryDate];
      if (!isValidDate) {
        console.log('Your cart contains an item from a day that is closed');
        res.status(400);
        throw new Error('Your cart contains an item from a day that is closed');
      }

      // Validate company
      const isValidCompany =
        upcomingDataMap[orderItem.deliveryDate][orderItem.companyId];
      if (!isValidCompany) {
        console.log(
          'Your cart contains an item from a restaurant that is not available for your company'
        );
        res.status(400);
        throw new Error(
          'Your cart contains an item from a restaurant that is not available for your company'
        );
      }

      // Validate restaurant
      const isValidRestaurant =
        upcomingDataMap[orderItem.deliveryDate][orderItem.companyId][
          orderItem.restaurantId
        ];
      if (!isValidRestaurant) {
        console.log(
          'Your cart contains an item from a restaurant that is closed'
        );
        res.status(400);
        throw new Error(
          'Your cart contains an item from a restaurant that is closed'
        );
      }

      // Validate quantity
      if (!orderItem.quantity) {
        console.log('One of your orders has invalid quantity');
        res.status(400);
        throw new Error('One of your orders has invalid quantity');
      }

      // Validate restaurant's order capacity
      const orderCapacity =
        upcomingDataMap[orderItem.deliveryDate][orderItem.companyId][
          orderItem.restaurantId
        ].orderCapacity;
      const hasOrderCapacity = checkOrderCapacity(
        orderItem.companyId,
        orderItem.deliveryDate,
        orderItem.restaurantId,
        orderItem.quantity,
        orderCapacity,
        activeOrders
      );
      if (!hasOrderCapacity) {
        const restaurant = upcomingRestaurants.find(
          (restaurant) =>
            restaurant._id.toString() === orderItem.restaurantId &&
            dateToMS(restaurant.schedule.date) === orderItem.deliveryDate
        );
        if (restaurant) {
          const message = `${
            restaurant.name
          } has reached order capacity on ${dateToText(
            restaurant.schedule.date
          )}`;
          console.log(message);
          res.status(400);
          throw new Error(message);
        }
      }

      // Validate item
      const isValidItem =
        upcomingDataMap[orderItem.deliveryDate][orderItem.companyId][
          orderItem.restaurantId
        ].item[orderItem.itemId];
      if (!isValidItem) {
        console.log('Your cart contains an invalid item');
        res.status(400);
        throw new Error('Your cart contains an invalid item');
      }

      // Validate optional addons
      if (orderItem.optionalAddons.length > 0) {
        const upcomingOptionalAddons =
          upcomingDataMap[orderItem.deliveryDate][orderItem.companyId][
            orderItem.restaurantId
          ].item[orderItem.itemId].optionalAddons;

        for (const orderOptionalAddon of orderItem.optionalAddons) {
          const validOptionalAddons = upcomingOptionalAddons.addons
            .split(',')
            .some(
              (upcomingOptionalAddon) =>
                upcomingOptionalAddon.split('-')[0].trim() ===
                orderOptionalAddon.split('-')[0].trim().toLowerCase()
            );

          if (
            orderItem.optionalAddons.length > upcomingOptionalAddons.addable ||
            !validOptionalAddons
          ) {
            console.log(
              'Your cart contains an item with invalid optional addons'
            );
            res.status(400);
            throw new Error(
              'Your cart contains an item with invalid optional addons'
            );
          }
        }
      }

      // Validate required addons
      if (orderItem.requiredAddons.length > 0) {
        const upcomingRequiredAddons =
          upcomingDataMap[orderItem.deliveryDate][orderItem.companyId][
            orderItem.restaurantId
          ].item[orderItem.itemId].requiredAddons;

        for (const orderRequiredAddon of orderItem.requiredAddons) {
          const validRequiredAddons = upcomingRequiredAddons.addons
            .split(',')
            .some(
              (upcomingOptionalAddon) =>
                upcomingOptionalAddon.split('-')[0].trim() ===
                orderRequiredAddon.split('-')[0].trim().toLowerCase()
            );

          if (
            orderItem.requiredAddons.length !==
              upcomingRequiredAddons.addable ||
            !validRequiredAddons
          ) {
            console.log(
              'Your cart contains an item with invalid required addons'
            );
            res.status(400);
            throw new Error(
              'Your cart contains an item with invalid required addons'
            );
          }
        }
      }

      // Validate removed ingredients
      if (orderItem.removedIngredients.length > 0) {
        const upcomingRemovableIngredients =
          upcomingDataMap[orderItem.deliveryDate][orderItem.companyId][
            orderItem.restaurantId
          ].item[orderItem.itemId].removableIngredients;

        for (const removedIngredient of orderItem.removedIngredients) {
          const validRemovableIngredients = upcomingRemovableIngredients
            ?.split(',')
            .some(
              (removableIngredient) =>
                removableIngredient.trim() ===
                removedIngredient.trim().toLowerCase()
            );

          if (!validRemovableIngredients) {
            console.log(
              'Your cart contains an item with invalid removable ingredients'
            );
            res.status(400);
            throw new Error(
              'Your cart contains an item with invalid removable ingredients'
            );
          }
        }
      }
    }

    // Validate applied discount
    let discount;
    if (discountCodeId) {
      const discountCode = await DiscountCode.findById(discountCodeId)
        .select('code value redeemability totalRedeem')
        .lean();
      if (!discountCode) {
        console.log('Invalid discount code');
        res.status(400);
        throw new Error('Invalid discount code');
      }
      const totalRedeem = discountCode.totalRedeem;
      const redeemability = discountCode.redeemability;
      if (redeemability === 'once' && totalRedeem >= 1) {
        console.log('Invalid discount code');
        res.status(400);
        throw new Error('Invalid discount code');
      }
      discount = {
        _id: discountCode._id,
        code: discountCode.code,
        value: discountCode.value,
      };
    }

    // Create orders
    const orders: Order[] = orderItems.map((orderItem) => {
      const restaurant = upcomingRestaurants.find(
        (upcomingRestaurant) =>
          upcomingRestaurant._id.toString() === orderItem.restaurantId
      );
      if (!restaurant) {
        console.log('Restaurant is not found');
        res.status(400);
        throw new Error('Restaurant is not found');
      }

      const company = companies.find(
        (company) => company._id.toString() === orderItem.companyId
      );
      if (!company) {
        console.log('Company is not found');
        res.status(400);
        throw new Error('Company is not found');
      }

      const item = restaurant.items.find(
        (item) => item._id?.toString() === orderItem.itemId
      );
      if (!item) {
        console.log('Item is not found');
        res.status(400);
        throw new Error('Item is not found');
      }

      const optionalAddons = createAddons(orderItem.optionalAddons);
      const requiredAddons = createAddons(orderItem.requiredAddons);
      const optionalAddonsPrice = getAddonsPrice(
        item.optionalAddons.addons,
        optionalAddons
      );
      const requiredAddonsPrice = getAddonsPrice(
        item.requiredAddons.addons,
        requiredAddons
      );
      const totalAddonsPrice =
        (optionalAddonsPrice || 0) + (requiredAddonsPrice || 0);

      return {
        customer: {
          _id: _id,
          firstName,
          lastName,
          email,
        },
        restaurant: {
          _id: restaurant._id,
          name: restaurant.name,
        },
        company: {
          _id: company._id,
          name: company.name,
          code: company.code,
          shift: company.shift,
        },
        delivery: {
          date: orderItem.deliveryDate,
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
          _id: item._id,
          name: item.name,
          tags: item.tags,
          description: item.description,
          quantity: orderItem.quantity,
          image: item.image || restaurant.logo,
          optionalAddons: optionalAddons.sort(sortIngredients).join(', '),
          requiredAddons: requiredAddons.sort(sortIngredients).join(', '),
          removedIngredients: orderItem.removedIngredients
            .sort(sortIngredients)
            .join(', '),
          total: toUSNumber(
            (item.price + totalAddonsPrice) * orderItem.quantity
          ),
        },
      };
    });

    // Get unique upcoming dates and company ids
    // Dates will be used to get the upcoming orders
    const upcomingDetails = upcomingRestaurants
      .map((upcomingRestaurant) => ({
        date: dateToMS(upcomingRestaurant.schedule.date),
        companyId: upcomingRestaurant.company._id,
      }))
      .filter(
        (detail, index, details) =>
          details.findIndex(
            (el) => el.date === detail.date && el.companyId === detail.companyId
          ) === index
      );

    // Get customer upcoming orders
    const customerUpcomingOrders = await Order.find({
      'customer._id': _id,
      status: {
        $nin: ['PENDING', 'ARCHIVED', 'CANCELLED'],
      },
      'delivery.date': {
        $gte: Math.min(
          ...upcomingDetails.map((upcomingDetail) => upcomingDetail.date)
        ),
      },
    })
      .select('delivery item company payment')
      .lean();

    // Get upcoming orders that matches order item dates
    const upcomingDateTotalDetails = customerUpcomingOrders
      .filter((upcomingOrder) =>
        orders.some(
          (order) =>
            order.delivery.date === dateToMS(upcomingOrder.delivery.date) &&
            order.company._id.toString() ===
              upcomingOrder.company._id.toString()
        )
      )
      .map((upcomingOrder) => ({
        shift: upcomingOrder.company.shift,
        date: dateToMS(upcomingOrder.delivery.date),
        companyId: upcomingOrder.company._id.toString(),
        total:
          upcomingOrder.item.total - (upcomingOrder.payment?.distributed || 0),
      }));

    // Get upcoming order date and total
    // with shift and company id details
    const upcomingOrderDetails = getDateTotal(upcomingDateTotalDetails);
    const orderDateTotalDetails = orders.map((order) => ({
      shift: order.company.shift,
      date: order.delivery.date,
      total: order.item.total,
      companyId: order.company._id.toString(),
    }));

    const orderItemDetails = getDateTotal(orderDateTotalDetails);
    const company = companies.find((company) => company.status === 'ACTIVE');
    const shiftBudget = company?.shiftBudget || 0;
    const payableDetails = orderItemDetails
      .map((orderItemDetail) => {
        const { total, ...rest } = orderItemDetail;
        if (
          !upcomingOrderDetails.some(
            (upcomingOrderDetail) =>
              upcomingOrderDetail.date === orderItemDetail.date
          )
        ) {
          return {
            ...rest,
            amount: orderItemDetail.total - shiftBudget,
          };
        } else {
          const upcomingOrderDetail = upcomingOrderDetails.find(
            (upcomingOrderDetail) =>
              upcomingOrderDetail.date === orderItemDetail.date
          );
          const upcomingDayOrderTotal = upcomingOrderDetail?.total || 0;
          return {
            ...rest,
            amount:
              upcomingDayOrderTotal >= shiftBudget
                ? orderItemDetail.total
                : orderItemDetail.total - (shiftBudget - upcomingDayOrderTotal),
          };
        }
      })
      .filter((detail) => detail.amount > 0);

    const payableAmount = payableDetails.reduce(
      (acc, curr) => acc + curr.amount,
      0
    );
    const discountAmount = discount?.value || 0;

    if (!payableAmount || payableAmount === discountAmount) {
      const response = await Order.insertMany(orders);
      const ordersForCustomers = response.map((order) => ({
        _id: order._id,
        item: order.item,
        status: order.status,
        createdAt: order.createdAt,
        restaurant: order.restaurant,
        delivery: {
          date: order.delivery.date,
        },
        isReviewed: order.isReviewed,
        company: { shift: order.company.shift },
      }));
      if (discountAmount > 0) {
        await DiscountCode.updateOne(
          { _id: discountCodeId },
          {
            $inc: {
              totalRedeem: 1,
            },
          }
        );
      }
      return res.status(201).json(ordersForCustomers);
    }

    // If payable amount is greater than discount amount
    const payableOrders = payableDetails.map((payable) => ({
      date: payable.date,
      companyId: payable.companyId,
      dateShift: `${dateToText(
        payable.date
      )} - ${`${payable.shift[0].toUpperCase()}${payable.shift.slice(1)}`}`,
      items: orders
        .filter(
          (order) =>
            order.delivery.date === payable.date &&
            order.company._id.toString() === payable.companyId
        )
        .map((order) => order.item.name),
      amount: payable.amount - discountAmount / payableDetails.length,
    }));
    const pendingOrderId = generateRandomString();

    // Update orders with payment and discount info
    let tempDiscountAmount = discountAmount;
    for (const order of orders) {
      const payableOrder = payableOrders.find(
        (payableOrder) =>
          payableOrder.date === order.delivery.date &&
          payableOrder.companyId === order.company._id.toString()
      );

      // Add payment info
      if (!payableOrder) continue;
      const sameDayPaymentOrders = orders.filter(
        (order) =>
          order.delivery.date === payableOrder.date &&
          order.company._id.toString() === payableOrder.companyId
      );
      order.status = 'PENDING';
      order.pendingOrderId = pendingOrderId;
      if (!order.payment) order.payment = {};
      order.payment.distributed = +(
        payableOrder.amount / sameDayPaymentOrders.length
      ).toFixed(2);

      // Add discount info
      if (!discount) continue;
      const payableDetail = payableDetails.find(
        (payableDetail) =>
          payableDetail.date === order.delivery.date &&
          payableDetail.companyId === order.company._id.toString()
      );
      if (!payableDetail) continue;
      const sameDayDiscountOrders = orders.filter(
        (order) =>
          order.delivery.date === payableDetail.date &&
          order.company._id.toString() === payableDetail.companyId
      );
      if (discountAmount > payableAmount) {
        const discountForOrder = +(
          payableDetail.amount / sameDayDiscountOrders.length
        ).toFixed(2);
        order.discount = { ...discount, distributed: discountForOrder };
      }
      if (payableDetail.amount >= discountAmount) {
        const discountForOrder = +(
          discountAmount / sameDayDiscountOrders.length
        ).toFixed(2);
        for (const sameDayDiscountOrder of sameDayDiscountOrders) {
          sameDayDiscountOrder.discount = {
            ...discount,
            distributed: discountForOrder,
          };
        }
        discountAmount -= discountForOrder;
      }
      if (discountAmount > payableDetail.amount) {
        const discountForOrder = +(
          payableDetail.amount / sameDayDiscountOrders.length
        ).toFixed(2);
        for (const sameDayDiscountOrder of sameDayDiscountOrders) {
          sameDayDiscountOrder.discount = {
            ...discount,
            distributed: discountForOrder,
          };
        }
        discountAmount -= discountForOrder;
      }
    }
    console.log(
      orders.map((order) => ({
        date: dateToText(order.delivery.date),
        paymentDist: order.payment?.distributed,
        discountDist: order.discount?.distributed,
      }))
    );
    return res.status(400).json({ message: 'tested' });
    const session = await stripeCheckout(
      email,
      pendingOrderId,
      discountCodeId,
      discountAmount,
      payableOrders
    );
    await Order.insertMany(orders);
    res.status(200).json(session.url);

    // Update restaurant schedule status after 3 minutes
    setTimeout(async () => {
      const latestActiveOrders = await getActiveOrders(
        companyIds,
        restaurantIds,
        deliveryDates
      );
      const restaurants = upcomingRestaurants.map((restaurant) => ({
        _id: restaurant._id,
        scheduledOn: restaurant.schedule.date,
        orderCapacity: restaurant.orderCapacity,
        companyId: restaurant.company._id,
      }));
      await updateRestaurantScheduleStatus(latestActiveOrders, restaurants);
    }, 3 * 60 * 1000);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Get all upcoming orders
router.get('/all-upcoming-orders', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const upcomingOrders = await Order.find({ status: 'PROCESSING' })
      .select('-__v -updatedAt')
      .sort({ 'delivery.date': 1 });
    res.status(200).json(upcomingOrders);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Get limited delivered orders
router.get('/all-delivered-orders/:limit', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { limit } = req.params;
  try {
    const deliveredOrders = await Order.find({ status: 'DELIVERED' })
      .limit(+limit)
      .select('-__v -updatedAt')
      .sort({ 'delivery.date': -1 });
    res.status(200).json(deliveredOrders);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Get all delivered orders of a customer
router.get('/:customerId/all-delivered-orders', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { customerId } = req.params;
  try {
    const customerDeliveredOrders = await Order.find({
      'customer._id': customerId,
      status: 'DELIVERED',
    })
      .sort({ 'delivery.date': -1 })
      .select('-__v -updatedAt');
    res.status(200).json(customerDeliveredOrders);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Change bulk orders and send delivery email
router.patch('/change-orders-status', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { orderIds } = req.body;
  if (!orderIds) {
    console.log('Please provide order ids');
    res.status(400);
    throw new Error('Please provide order ids');
  }

  try {
    await Order.updateMany(
      { _id: { $in: orderIds }, status: 'PROCESSING' },
      { $set: { status: 'DELIVERED' } }
    );
    const orders = await Order.find({ _id: { $in: orderIds } });
    await Promise.all(
      orders.map(
        async (order) =>
          await mail.send(orderDeliveryTemplate(order.toObject()))
      )
    );
    res.status(200).json('Delivery email sent');
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Change single order status
router.patch('/:orderId/change-order-status', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { orderId } = req.params;
  try {
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId, status: 'PROCESSING' },
      {
        status: 'ARCHIVED',
      },
      { returnDocument: 'after' }
    )
      .select('-__v -updatedAt')
      .orFail();
    await mail.send(orderArchiveTemplate(updatedOrder.toObject()));
    res.status(201).json(updatedOrder);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Cancel an order: by customer
router.patch('/:orderId/cancel', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { orderId } = req.params;
  try {
    const order = await Order.findOne({
      _id: orderId,
      status: 'PROCESSING',
    }).orFail();
    const restaurant = await Restaurant.findById(order.restaurant._id).orFail();

    const isScheduled = restaurant.schedules.some(
      (schedule) =>
        schedule.status === 'ACTIVE' &&
        dateToMS(schedule.date) === dateToMS(order.delivery.date)
    );
    if (!isScheduled) {
      console.log('Order changes are closed. Please contact support');
      res.status(400);
      throw new Error('Order changes are closed. Please contact support');
    }
    order.status = 'CANCELLED';

    if (!order.payment) {
      await order.save();
      await mail.send(orderCancelTemplate(order.toObject()));
      return res.status(200).json({ message: 'Order cancelled' });
    }

    const distributed = order.payment.distributed;
    if (distributed) {
      await stripeRefund(distributed, order.payment.intent);
      await order.save();
      await mail.send(orderRefundTemplate(order.toObject(), distributed));
      return res
        .status(200)
        .json({ message: `Order cancelled and $${distributed} refunded` });
    }

    //TODO: Remove below code after August 17, 2024
    const refunded = await stripeRefundAmount(order.payment.intent);
    const askingRefund = order.item.total;
    const totalPaid = order.payment.total;
    const totalRefund = refunded + askingRefund;

    if (totalPaid === refunded) {
      await order.save();
      await mail.send(orderCancelTemplate(order.toObject()));
      return res.status(200).json({ message: 'Order cancelled' });
    }

    if (totalPaid >= totalRefund) {
      await stripeRefund(askingRefund, order.payment.intent);
      await order.save();
      await mail.send(orderRefundTemplate(order.toObject(), askingRefund));
      return res
        .status(200)
        .json({ message: `Order cancelled and $${askingRefund} refunded` });
    }

    if (totalPaid < totalRefund) {
      const finalRefund = totalPaid - refunded;
      await stripeRefund(finalRefund, order.payment.intent);
      await order.save();
      await mail.send(orderRefundTemplate(order.toObject(), finalRefund));
      return res
        .status(200)
        .json({ message: `Order cancelled and $${finalRefund} refunded` });
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
});

export default router;
