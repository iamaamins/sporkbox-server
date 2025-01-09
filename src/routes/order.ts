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
  updateScheduleStatus,
  createOrders,
  docToObj,
} from '../lib/utils';
import {
  orderArchive,
  orderCancel,
  orderDelivery,
  orderRefund,
} from '../lib/emails';
import mail from '@sendgrid/mail';
import { stripeCheckout, stripeRefund } from '../config/stripe';
import DiscountCode from '../models/discountCode';
import Restaurant from '../models/restaurant';
import { invalidCredentials, unAuthorized } from '../lib/messages';
import { OrdersPayload, UpcomingDataMap, Order as OrderType } from '../types';
import User from '../models/user';

const router = Router();

// Get vendor's all upcoming orders
router.get('/vendor/upcoming-orders', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    console.error(unAuthorized);
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
        'customer.firstName customer.lastName restaurant._id restaurant.name company._id company.code company.shift delivery.date item._id item.name item.quantity item.optionalAddons item.requiredAddons item.removedIngredients'
      );
    res.status(200).json(allUpcomingOrders);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get customer's all upcoming orders
router.get('/me/upcoming-orders', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const allUpcomingOrders = await Order.find({
      'customer._id': req.user._id,
      status: 'PROCESSING',
    })
      .sort({ 'delivery.date': 1 })
      .select('-__v -updatedAt -customer -delivery.address -company.name');
    res.status(200).json(allUpcomingOrders);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get customer's limited delivered orders
router.get('/me/delivered-orders/:limit', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
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
    console.error(err);
    throw err;
  }
});

// Create orders
router.post('/create-orders', auth, async (req, res) => {
  if (
    !req.user ||
    !(req.user.role === 'CUSTOMER' || req.user.role === 'ADMIN')
  ) {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  if (req.user.role === 'ADMIN' && !req.body.userId) {
    res.status(400);
    throw new Error('Please provide employee ID');
  }

  try {
    const user =
      req.user.role === 'CUSTOMER'
        ? req.user
        : await User.findOne({ _id: req.body.userId })
            .select('-__v -updatedAt -password')
            .lean()
            .orFail();

    if (user.status !== 'ACTIVE') {
      res.status(400);
      throw new Error('User must be active');
    }

    const { _id, firstName, lastName, email, companies } = user;
    if (!companies || companies.length === 0) {
      console.error(invalidCredentials);
      res.status(403);
      throw new Error(invalidCredentials);
    }

    const { orderItems, discountCodeId }: OrdersPayload = req.body;
    if (!orderItems || !orderItems.length) {
      console.error('Please provide valid order items');
      res.status(400);
      throw new Error('Please provide valid order items');
    }

    // Get upcoming week restaurants
    // to validate the orders,
    // to get the order item details, and
    // to get scheduled dates and company ids
    const upcomingRestaurants = await getUpcomingRestaurants(
      res,
      companies,
      true
    );
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
    const activeOrders = await getActiveOrders(restaurantIds, deliveryDates);

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
        console.error('Your cart contains an item from a day that is closed');
        res.status(400);
        throw new Error('Your cart contains an item from a day that is closed');
      }

      // Validate company
      const isValidCompany =
        upcomingDataMap[orderItem.deliveryDate][orderItem.companyId];
      if (!isValidCompany) {
        console.error(
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
        console.error(
          'Your cart contains an item from a restaurant that is closed'
        );
        res.status(400);
        throw new Error(
          'Your cart contains an item from a restaurant that is closed'
        );
      }

      // Validate quantity
      if (!orderItem.quantity) {
        console.error('One of your orders has invalid quantity');
        res.status(400);
        throw new Error('One of your orders has invalid quantity');
      }

      // Validate restaurant's order capacity
      const orderCapacity =
        upcomingDataMap[orderItem.deliveryDate][orderItem.companyId][
          orderItem.restaurantId
        ].orderCapacity;
      const hasOrderCapacity = checkOrderCapacity(
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
          console.error(message);
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
        console.error('Your cart contains an invalid item');
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
            console.error(
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
            console.error(
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
            console.error(
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
        console.error('Invalid discount code');
        res.status(400);
        throw new Error('Invalid discount code');
      }
      const totalRedeem = discountCode.totalRedeem;
      const redeemability = discountCode.redeemability;
      if (redeemability === 'once' && totalRedeem >= 1) {
        console.error('Invalid discount code');
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
    const orders: OrderType[] = orderItems.map((orderItem) => {
      const restaurant = upcomingRestaurants.find(
        (upcomingRestaurant) =>
          upcomingRestaurant._id.toString() === orderItem.restaurantId
      );
      if (!restaurant) {
        console.error('Restaurant is not found');
        res.status(400);
        throw new Error('Restaurant is not found');
      }

      const company = companies.find(
        (company) => company._id.toString() === orderItem.companyId
      );
      if (!company) {
        console.error('Company is not found');
        res.status(400);
        throw new Error('Company is not found');
      }

      const item = restaurant.items.find(
        (item) => item._id?.toString() === orderItem.itemId
      );
      if (!item) {
        console.error('Item is not found');
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

    // Place the orders if the user is a guest
    const restaurantsData = upcomingRestaurants.map((restaurant) => ({
      _id: restaurant._id,
      scheduledOn: restaurant.schedule.date,
      orderCapacity: restaurant.orderCapacity,
    }));
    if (user.role === 'GUEST') {
      await createOrders(res, orders, req.user.role);
      return updateScheduleStatus(
        restaurantIds,
        deliveryDates,
        restaurantsData
      );
    }

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

    // Get user upcoming orders
    const userUpcomingOrders = await Order.find({
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

    // Get upcoming orders date total detail
    const upcomingDateTotalDetails = userUpcomingOrders
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
    const upcomingOrderDetails = getDateTotal(upcomingDateTotalDetails);

    // Get current orders date total detail
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
    if (!payableAmount) {
      await createOrders(res, orders, req.user.role);
      return updateScheduleStatus(
        restaurantIds,
        deliveryDates,
        restaurantsData
      );
    }

    // Create orders with payment and discount
    const discountAmount = discount?.value || 0;
    let tempDiscountAmount = discountAmount;

    const ordersWithPayment = [];
    const ordersWithDiscount = [];

    for (const payableDetail of payableDetails) {
      let payment = 0;
      let discount = 0;
      if (discountAmount >= payableAmount) {
        payment = 0;
        discount = payableDetail.amount;
      }
      if (discountAmount < payableAmount && !tempDiscountAmount) {
        payment = payableDetail.amount;
        discount = 0;
      }
      if (
        discountAmount < payableAmount &&
        tempDiscountAmount <= payableDetail.amount
      ) {
        payment = payableDetail.amount - tempDiscountAmount;
        discount = tempDiscountAmount;
        tempDiscountAmount -= tempDiscountAmount;
      }
      if (
        discountAmount < payableAmount &&
        payableDetail.amount < tempDiscountAmount
      ) {
        payment = 0;
        discount = payableDetail.amount;
        tempDiscountAmount -= payableDetail.amount;
      }
      if (payment) {
        ordersWithPayment.push({
          date: payableDetail.date,
          companyId: payableDetail.companyId,
          dateShift: `${dateToText(
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
          amount: payment,
        });
      }
      if (discount) {
        ordersWithDiscount.push({
          date: payableDetail.date,
          companyId: payableDetail.companyId,
          amount: discount,
        });
      }
    }

    // Update orders with payment and discount info
    const pendingOrderId = generateRandomString();
    for (const order of orders) {
      // Update order status and add payment info
      if (ordersWithPayment.length) {
        order.status = 'PENDING';
        order.pendingOrderId = pendingOrderId;

        const orderWithPayment = ordersWithPayment.find(
          (orderWithPayment) =>
            orderWithPayment.date === order.delivery.date &&
            orderWithPayment.companyId === order.company._id.toString()
        );
        if (orderWithPayment && !order.payment) {
          const sameDayOrders = orders.filter(
            (order) =>
              order.delivery.date === orderWithPayment.date &&
              order.company._id.toString() === orderWithPayment.companyId
          );
          const distributed = orderWithPayment.amount / sameDayOrders.length;
          for (const sameDayOrder of sameDayOrders) {
            sameDayOrder.payment = {};
            sameDayOrder.payment.distributed = distributed;
          }
        }
      }

      // Add discount info
      if (ordersWithDiscount.length) {
        const orderWithDiscount = ordersWithDiscount.find(
          (orderWithDiscount) =>
            orderWithDiscount.date === order.delivery.date &&
            orderWithDiscount.companyId === order.company._id.toString()
        );
        if (discount && orderWithDiscount && !order.discount) {
          const sameDayOrders = orders.filter(
            (order) =>
              order.delivery.date === orderWithDiscount.date &&
              order.company._id.toString() === orderWithDiscount.companyId
          );
          const distributed = orderWithDiscount.amount / sameDayOrders.length;
          for (const sameDayOrder of sameDayOrders) {
            sameDayOrder.discount = {
              ...discount,
              distributed: distributed,
            };
          }
        }
      }
    }

    if (!ordersWithPayment.length) {
      await createOrders(
        res,
        orders,
        req.user.role,
        discountCodeId,
        discountAmount
      );
      return updateScheduleStatus(
        restaurantIds,
        deliveryDates,
        restaurantsData
      );
    }

    const session = await stripeCheckout(
      req.user.role,
      email,
      pendingOrderId,
      discountCodeId,
      discountAmount,
      ordersWithPayment
    );
    await Order.insertMany(orders);
    res.status(200).json(session.url);
    updateScheduleStatus(
      restaurantIds,
      deliveryDates,
      restaurantsData,
      3 * 60 * 1000
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get all upcoming orders
router.get('/all-upcoming-orders', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const upcomingOrders = await Order.find({ status: 'PROCESSING' })
      .sort({ 'delivery.date': 1 })
      .select('-__v -updatedAt');
    res.status(200).json(upcomingOrders);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get limited delivered orders
router.get('/all-delivered-orders/:limit', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { limit } = req.params;
  try {
    let deliveredOrders = await Order.find({ status: 'DELIVERED' })
      .limit(+limit)
      .select('-__v -updatedAt')
      .sort({ 'delivery.date': -1 })
      .lean();

    const lastOrder = deliveredOrders.at(-1);
    if (lastOrder) {
      const lastOrderDeliveryDateMS = dateToMS(lastOrder.delivery.date);
      const dbOrderCount = await Order.countDocuments({
        status: 'DELIVERED',
        'delivery.date': lastOrderDeliveryDateMS,
      });
      const localOrderCount = deliveredOrders.filter(
        (order) => dateToMS(order.delivery.date) === lastOrderDeliveryDateMS
      ).length;

      if (dbOrderCount > localOrderCount) {
        deliveredOrders = deliveredOrders.filter(
          (order) => dateToMS(order.delivery.date) !== lastOrderDeliveryDateMS
        );
      }
    }
    res.status(200).json(deliveredOrders);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get all delivered orders of a customer
router.get('/:customerId/all-delivered-orders', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
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
    console.error(err);
    throw err;
  }
});

// Deliver orders
router.patch('/deliver', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { orderIds } = req.body;
  if (!orderIds) {
    console.error('Please provide order ids');
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
        async (order) => await mail.send(orderDelivery(docToObj(order)))
      )
    );
    res.status(200).json('Delivery email sent');
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Archive an order by admin
router.patch('/:orderId/archive', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
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

    if (updatedOrder.payment && updatedOrder.payment.distributed)
      await stripeRefund(
        updatedOrder.payment.distributed,
        updatedOrder.payment.intent
      );

    await mail.send(orderArchive(docToObj(updatedOrder)));
    res.status(201).json(updatedOrder);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Cancel an order by customer
router.patch('/:orderId/cancel', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
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
      console.error('Order changes are closed. Please contact support');
      res.status(400);
      throw new Error('Order changes are closed. Please contact support');
    }
    order.status = 'CANCELLED';

    if (!order.payment || !order.payment.distributed) {
      await order.save();
      await mail.send(orderCancel(docToObj(order)));
      return res.status(200).json({ message: 'Order cancelled' });
    }

    const distributed = order.payment.distributed;
    if (distributed) {
      await stripeRefund(distributed, order.payment.intent);
      await order.save();
      await mail.send(orderRefund(docToObj(order), distributed));
      return res.status(200).json({
        message: `Order cancelled and $${distributed.toFixed(2)} refunded`,
      });
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get weekly order stat
router.get('/weekly-stat/:start/:end', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { start, end } = req.params;
  try {
    const orders = await Order.find({
      status: { $in: ['DELIVERED', 'PROCESSING'] },
      'delivery.date': { $gte: start, $lte: end },
    })
      .select('delivery.date customer._id')
      .lean();

    const statMap: Record<string, string[]> = {};
    for (const order of orders) {
      const key = order.delivery.date.toISOString().split('T')[0];
      const customerId = order.customer._id.toString();
      if (!statMap[key]) {
        statMap[key] = [customerId];
      } else {
        if (!statMap[key].includes(customerId)) statMap[key].push(customerId);
      }
    }

    let stat = [];
    for (const key in statMap) {
      stat.push({ date: key, count: statMap[key].length });
    }
    res.status(200).json(stat);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get price stat
router.get('/payment-stat/:start/:end', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { start, end } = req.params;
  try {
    const orders = await Order.find({
      status: { $in: ['PROCESSING', 'DELIVERED'] },
      createdAt: { $gte: start, $lte: end },
    })
      .select('customer._id item.total payment.distributed')
      .lean();

    let totalSpent = 0;
    let totalPaid = 0;
    const payingEmployeeMap: Record<string, boolean> = {};
    for (const order of orders) {
      totalSpent += order.item.total;
      if (order.payment?.distributed) {
        totalPaid += order.payment.distributed;
        const key = order.customer._id.toString();
        if (!payingEmployeeMap[key]) payingEmployeeMap[key] = true;
      }
    }

    const payingEmployeeCount = Object.keys(payingEmployeeMap).length;
    res.status(200).json({
      averageSpent: totalSpent / orders.length,
      averagePaid: totalPaid / payingEmployeeCount,
      payingEmployeeCount,
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get top-rated restaurants
router.get('/restaurant-stat', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 60);

  try {
    const orders = await Order.find({
      createdAt: {
        $gte: pastDate,
      },
    });

    type RestaurantsMap = Record<string, { name: string; orderCount: number }>;
    type ItemsMap = Record<
      string,
      { name: string; restaurant: string; orderCount: number }
    >;
    const restaurantsMap: RestaurantsMap = {};
    const itemsMap: ItemsMap = {};

    for (const order of orders) {
      const restaurant = order.restaurant._id.toString();
      if (!restaurantsMap[restaurant]) {
        restaurantsMap[restaurant] = {
          name: order.restaurant.name,
          orderCount: 1,
        };
      } else {
        restaurantsMap[restaurant].orderCount++;
      }

      const item = order.item._id.toString();
      if (!itemsMap[item]) {
        itemsMap[item] = {
          name: order.item.name,
          restaurant: order.restaurant.name,
          orderCount: 1,
        };
      } else {
        itemsMap[item].orderCount++;
      }
    }
    const getData = (dataMap: RestaurantsMap | ItemsMap) =>
      Object.values(dataMap)
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 10);
    res
      .status(200)
      .json({ restaurants: getData(restaurantsMap), items: getData(itemsMap) });
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
