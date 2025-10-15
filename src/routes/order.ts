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
  getTodayTimestamp,
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
import { postSlackMessage } from '../config/slack';
import company from '../models/company';

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
        'customer.firstName customer.lastName restaurant._id restaurant.name company._id company.code company.shift delivery.date item._id item.name item.quantity item.optionalAddons item.requiredAddonsOne item.requiredAddonsTwo item.removedIngredients'
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

// Get customer's food stats
router.get('/me/food-stats', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const filters = {
      'customer._id': req.user._id,
      status: { $in: ['DELIVERED', 'PROCESSING'] },
    };

    const orderCount = await Order.countDocuments(filters);
    const [{ itemCount, restaurantCount }] = await Order.aggregate([
      { $match: filters },
      {
        $group: {
          _id: null,
          itemCount: { $sum: '$item.quantity' },
          restaurantCount: { $addToSet: '$restaurant._id' },
        },
      },
      {
        $project: {
          _id: 0,
          itemCount: 1,
          restaurantCount: { $size: '$restaurantCount' },
        },
      },
    ]).allowDiskUse(true);

    res.status(200).json({ orderCount, itemCount, restaurantCount });
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get customer's most liked restaurants and items
router.get('/me/most-liked-restaurants-and-items', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    // Get the date 6 months past today
    const start = new Date();
    start.setMonth(start.getMonth() - 6);

    // Get restaurant order history
    const restaurants = await Order.aggregate([
      {
        $match: {
          status: { $in: ['DELIVERED', 'PROCESSING'] },
          'customer._id': req.user._id,
          createdAt: { $gte: start },
        },
      },
      {
        $group: {
          _id: '$restaurant._id',
          name: { $first: '$restaurant.name' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, name: 1 } },
    ]).allowDiskUse(true);

    // Get item order history
    const items = await Order.aggregate([
      {
        $match: {
          status: { $in: ['DELIVERED', 'PROCESSING'] },
          'customer._id': req.user._id,
          createdAt: { $gte: start },
        },
      },
      {
        $group: {
          _id: '$item._id',
          name: { $first: '$item.name' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, name: 1 } },
    ]).allowDiskUse(true);

    res.status(200).json({
      restaurants: restaurants.map((restaurant) => restaurant.name),
      items: items.map((item) => item.name),
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get customer's reviewed orders' rating data
router.post('/me/rating-data', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { orderIds }: { orderIds: string[] } = req.body;
  if (!orderIds || !Array.isArray(orderIds) || !orderIds.length) {
    console.error('Order Ids are required');
    res.status(400);
    throw new Error('Order Ids are required');
  }

  try {
    const orders = await Order.find({
      'customer._id': req.user._id,
      _id: { $in: orderIds },
      status: 'DELIVERED',
      isReviewed: true,
    })
      .select('_id restaurant item')
      .limit(5)
      .lean();

    const restaurantIds = orders
      .map((order) => order.restaurant._id.toString())
      .filter((id, index, ids) => ids.indexOf(id) === index);

    const itemIds = orders
      .map((order) => order.item._id.toString())
      .filter((id, index, ids) => ids.indexOf(id) === index);

    const restaurants = await Restaurant.find({
      _id: { $in: restaurantIds },
      'items._id': { $in: itemIds },
    })
      .select('items')
      .lean();

    const userId = req.user._id.toString();
    const ratingData: { orderId: string; rating: number }[] = [];

    for (const order of orders) {
      const restaurant = restaurants.find(
        (restaurant) =>
          restaurant._id.toString() === order.restaurant._id.toString()
      );
      if (!restaurant) continue;

      const item = restaurant.items.find(
        (item) => item._id.toString() === order.item._id.toString()
      );
      if (!item) continue;

      const latestReview = item.reviews
        .filter((review) => review.customer?.toString() === userId)
        .pop();
      if (!latestReview) continue;

      ratingData.push({
        orderId: order._id.toString(),
        rating: latestReview.rating,
      });
    }

    res.status(200).json(ratingData);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Create orders
router.post('/create-orders', auth, async (req, res) => {
  if (
    !req.user ||
    (req.user.role !== 'ADMIN' && req.user.role !== 'CUSTOMER')
  ) {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  if (req.body.orderingForUser && !req.body.orderingForUser.id) {
    console.error('User id is required');
    res.status(400);
    throw new Error('User id is required');
  }

  try {
    const user = !req.body.orderingForUser
      ? req.user
      : await User.findOne({ _id: req.body.orderingForUser.id })
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
          requiredAddonsOne: item.requiredAddonsOne,
          requiredAddonsTwo: item.requiredAddonsTwo,
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
      if (orderItem.requiredAddonsOne.length > 0) {
        const upcomingRequiredAddonsOne =
          upcomingDataMap[orderItem.deliveryDate][orderItem.companyId][
            orderItem.restaurantId
          ].item[orderItem.itemId].requiredAddonsOne;

        for (const orderRequiredAddon of orderItem.requiredAddonsOne) {
          const validRequiredAddons = upcomingRequiredAddonsOne.addons
            .split(',')
            .some(
              (upcomingRequiredAddon) =>
                upcomingRequiredAddon.split('-')[0].trim() ===
                orderRequiredAddon.split('-')[0].trim().toLowerCase()
            );

          if (
            orderItem.requiredAddonsOne.length !==
              upcomingRequiredAddonsOne.addable ||
            !validRequiredAddons
          ) {
            console.error(
              'Your cart contains an item with invalid required addons 1'
            );
            res.status(400);
            throw new Error(
              'Your cart contains an item with invalid required addons 1'
            );
          }
        }
      }

      // Validate extra required addons
      if (orderItem.requiredAddonsTwo.length > 0) {
        const upcomingExtraRequiredAddonsTwo =
          upcomingDataMap[orderItem.deliveryDate][orderItem.companyId][
            orderItem.restaurantId
          ].item[orderItem.itemId].requiredAddonsTwo;

        for (const orderRequiredAddon of orderItem.requiredAddonsTwo) {
          const validRequiredAddons = upcomingExtraRequiredAddonsTwo.addons
            .split(',')
            .some(
              (upcomingExtraRequiredAddon) =>
                upcomingExtraRequiredAddon.split('-')[0].trim() ===
                orderRequiredAddon.split('-')[0].trim().toLowerCase()
            );

          if (
            orderItem.requiredAddonsTwo.length !==
              upcomingExtraRequiredAddonsTwo.addable ||
            !validRequiredAddons
          ) {
            console.error(
              'Your cart contains an item with invalid extra required addons 2'
            );
            res.status(400);
            throw new Error(
              'Your cart contains an item with invalid extra required addons 2'
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
      const requiredAddonsOne = createAddons(orderItem.requiredAddonsOne);
      const requiredAddonsTwo = createAddons(orderItem.requiredAddonsTwo);

      const optionalAddonsPrice = getAddonsPrice(
        item.optionalAddons.addons,
        optionalAddons
      );
      const requiredAddonsOnePrice = getAddonsPrice(
        item.requiredAddonsOne.addons,
        requiredAddonsOne
      );
      const requiredAddonsTwoPrice = getAddonsPrice(
        item.requiredAddonsTwo.addons,
        requiredAddonsTwo
      );

      const totalAddonsPrice =
        (optionalAddonsPrice || 0) +
        (requiredAddonsOnePrice || 0) +
        (requiredAddonsTwoPrice || 0);

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
          requiredAddonsOne: requiredAddonsOne.sort(sortIngredients).join(', '),
          requiredAddonsTwo: requiredAddonsTwo.sort(sortIngredients).join(', '),
          removedIngredients: orderItem.removedIngredients
            .sort(sortIngredients)
            .join(', '),
          total: toUSNumber(
            (item.price + totalAddonsPrice) * orderItem.quantity
          ),
        },
      };
    });

    // Get restaurant data to update the schedule status
    const restaurantsData = upcomingRestaurants.map((restaurant) => ({
      _id: restaurant._id,
      scheduledOn: restaurant.schedule.date,
      orderCapacity: restaurant.orderCapacity,
    }));

    // Place the orders if the user is a guest
    if (user.role === 'GUEST') {
      if (discount) {
        const orderTotal = orders.reduce(
          (acc, curr) => curr.item.total + acc,
          0
        );
        const discountValue = Math.min(orderTotal, discount.value);

        for (const order of orders) {
          order.discount = {
            ...discount,
            distributed: discountValue / orders.length,
          };
        }
      }

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
    const pendingKey = generateRandomString();
    for (const order of orders) {
      // Update order status and add payment info
      if (ordersWithPayment.length) {
        order.status = 'PENDING';
        order.pendingKey = pendingKey;

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

    const ordersPlacedBy =
      req.user._id.toString() === _id.toString()
        ? 'SELF'
        : req.user.role === 'ADMIN'
        ? 'ADMIN'
        : 'COMPANY_ADMIN';

    const session = await stripeCheckout(
      _id.toString(),
      email,
      pendingKey,
      discountCodeId,
      discountAmount,
      ordersPlacedBy,
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
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'DRIVER')) {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { action, orderIds } = req.body as {
    action: 'deliver' | 'mark delivered';
    orderIds: string[];
  };

  if (req.user.role === 'DRIVER' && action === 'mark delivered') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  if (!action || (action !== 'deliver' && action !== 'mark delivered')) {
    console.error('Please provide a valid delivery action');
    res.status(400);
    throw new Error('Please provide a valid delivery action');
  }

  if (!orderIds || !orderIds.length) {
    console.error('Please provide order ids');
    res.status(400);
    throw new Error('Please provide order ids');
  }

  try {
    const orders = await Order.find({
      _id: { $in: orderIds },
      status: 'PROCESSING',
    });

    let groupKey: string | null = null;
    let companyIds: string[] = [];
    for (const order of orders) {
      const tempKey = `${order.delivery.date.toISOString()}-${
        order.company.code
      }-${order.restaurant._id}`;

      if (!groupKey) {
        groupKey = tempKey;
      } else if (groupKey !== tempKey) {
        console.error('Invalid order ids');
        res.status(400);
        throw new Error('Invalid order ids');
      }

      const companyId = order.company._id.toString();
      if (!companyIds.includes(companyId)) companyIds.push(companyId);
    }

    await Order.updateMany(
      { _id: { $in: orderIds }, status: 'PROCESSING' },
      {
        $set: {
          status: 'DELIVERED',
          deliveredBy: {
            id: req.user._id,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
          },
        },
      }
    );

    if (action === 'deliver') {
      await Promise.allSettled(
        orders.map(
          async (order) => await mail.send(orderDelivery(docToObj(order)))
        )
      );

      const companies = await company
        .find({ _id: { $in: companyIds } })
        .select('slackChannel');

      await Promise.allSettled(
        companies.map(
          async (company) =>
            company.slackChannel &&
            (await postSlackMessage(
              orders[0].restaurant.name,
              company.slackChannel
            ))
        )
      );
    }

    res
      .status(200)
      .json(
        action === 'deliver'
          ? 'Orders are delivered with notifications'
          : 'Orders are delivered without notifications'
      );
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Archive an order by admin and company admin
router.patch('/:orderId/archive', auth, async (req, res) => {
  if (
    !req.user ||
    (req.user.role !== 'ADMIN' &&
      (req.user.role !== 'CUSTOMER' || !req.user.isCompanyAdmin))
  ) {
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

// Get weekly order stat by company
router.get('/:companyCode/weekly-stat/:start/:end', auth, async (req, res) => {
  if (
    !req.user ||
    req.user.role !== 'CUSTOMER' ||
    !req.user.isCompanyAdmin ||
    req.user.companies[0].code !== req.params.companyCode
  ) {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { start, end, companyCode } = req.params;
  try {
    const orders = await Order.find({
      'company.code': companyCode,
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

// Get payment stat
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

// Get payment stat by company
router.get('/:companyCode/payment-stat/:start/:end', auth, async (req, res) => {
  if (
    !req.user ||
    req.user.role !== 'CUSTOMER' ||
    !req.user.isCompanyAdmin ||
    req.user.companies[0].code !== req.params.companyCode
  ) {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { start, end, companyCode } = req.params;
  try {
    const orders = await Order.find({
      'company.code': companyCode,
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

// Get most liked restaurants
router.get('/restaurant-stat/:start/:end', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { start, end } = req.params;
  try {
    const restaurants = await Order.aggregate([
      {
        $match: { createdAt: { $gte: new Date(start), $lte: new Date(end) } },
      },
      {
        $group: {
          _id: '$restaurant._id',
          name: { $first: '$restaurant.name' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, name: 1, orderCount: 1 } },
    ]).allowDiskUse(true);

    res.status(200).json(restaurants);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get most liked items
router.get('/item-stat/:start/:end', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { start, end } = req.params;
  try {
    const items = await Order.aggregate([
      {
        $match: { createdAt: { $gte: new Date(start), $lte: new Date(end) } },
      },
      {
        $group: {
          _id: '$item._id',
          name: { $first: '$item.name' },
          restaurant: { $first: '$restaurant.name' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, name: 1, restaurant: 1, orderCount: 1 } },
    ]).allowDiskUse(true);

    res.status(200).json(items);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get most liked restaurants by company
router.get(
  '/:companyCode/restaurant-stat/:start/:end',
  auth,
  async (req, res) => {
    if (
      !req.user ||
      req.user.role !== 'CUSTOMER' ||
      !req.user.isCompanyAdmin ||
      req.user.companies[0].code !== req.params.companyCode
    ) {
      console.error(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const { start, end, companyCode } = req.params;
    try {
      const restaurants = await Order.aggregate([
        {
          $match: {
            'company.code': companyCode,
            createdAt: { $gte: new Date(start), $lte: new Date(end) },
          },
        },
        {
          $group: {
            _id: '$restaurant._id',
            name: { $first: '$restaurant.name' },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { orderCount: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, name: 1, orderCount: 1 } },
      ]).allowDiskUse(true);

      res.status(200).json(restaurants);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
);

// Get most liked items by company
router.get('/:companyCode/item-stat/:start/:end', auth, async (req, res) => {
  if (
    !req.user ||
    req.user.role !== 'CUSTOMER' ||
    !req.user.isCompanyAdmin ||
    req.user.companies[0].code !== req.params.companyCode
  ) {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { start, end, companyCode } = req.params;
  try {
    const items = await Order.aggregate([
      {
        $match: {
          'company.code': companyCode,
          createdAt: { $gte: new Date(start), $lte: new Date(end) },
        },
      },
      {
        $group: {
          _id: '$item._id',
          name: { $first: '$item.name' },
          restaurant: { $first: '$restaurant.name' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, name: 1, restaurant: 1, orderCount: 1 } },
    ]).allowDiskUse(true);

    res.status(200).json(items);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get today's orders for delivery driver
router.get('/driver-orders', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'DRIVER') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const orders = await Order.find({
      status: 'PROCESSING',
      'delivery.date': getTodayTimestamp(),
    });

    res.status(200).json(orders);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
