import { Router } from 'express';
import Order from '../models/order';
import auth from '../middleware/auth';
import { dateToMS, dateToText } from '../lib/utils';
import { unAuthorized } from '../lib/messages';
import Restaurant from '../models/restaurant';
import { CustomerStat, ItemStat, OrderStat } from '../types';
import User from '../models/user';
import { Types } from 'mongoose';

const router = Router();

async function getDeliveredOrders() {
  const newDate = new Date();
  const year = newDate.getFullYear();
  const month = `${newDate.getMonth() + 1}`.padStart(2, '0');
  const date = `${newDate.getDate()}`.padStart(2, '0');

  const from = `${year}-01-01`;
  const to = `${year}-${month}-${date}`;

  try {
    const orders = await Order.find({
      status: 'DELIVERED',
      // 'company._id': {
      //   $in: ['643dec49e88d25d4249723ef', '643e162fe88d25d424972a55'],
      // },
      'delivery.date': {
        $gte: from,
        $lte: to,
      },
    })
      .lean()
      .orFail();

    return orders;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

function getDates() {
  const newDate = new Date();
  const year = newDate.getFullYear();
  const month = `${newDate.getMonth() + 1}`.padStart(2, '0');
  const date = `${newDate.getDate()}`.padStart(2, '0');

  const from = new Date(`${year}-01-01`);
  const to = new Date(`${year}-${month}-${date}`);

  return { from, to };
}

const getCompanyIds = () => [
  new Types.ObjectId('643dec49e88d25d4249723ef'),
  new Types.ObjectId('643e162fe88d25d424972a55'),
];

router.get('/order', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const { from, to } = getDates();
    const companyIds = getCompanyIds();

    const results = await Order.aggregate([
      {
        $match: {
          status: 'DELIVERED',
          'company._id': { $in: companyIds },
          'delivery.date': { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$restaurant._id',
          restaurant: { $first: '$restaurant' },
          quantity: { $sum: '$item.quantity' },
        },
      },
      {
        $project: {
          _id: 0,
          restaurant: {
            id: { $toString: '$_id' },
            name: '$restaurant.name',
          },
          quantity: 1,
        },
      },
    ]);

    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

router.get('/item', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const { from, to } = getDates();
    const companyIds = getCompanyIds();

    const results = await Order.aggregate([
      {
        $match: {
          status: 'DELIVERED',
          'company._id': { $in: companyIds },
          'delivery.date': { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            itemId: '$item._id',
            restaurantId: '$restaurant._id',
          },
          restaurant: { $first: '$restaurant' },
          item: { $first: '$item' },
          quantity: { $sum: '$item.quantity' },
        },
      },
      {
        $project: {
          _id: 0,
          restaurant: {
            id: { $toString: '$restaurant._id' },
            name: '$restaurant.name',
          },
          item: {
            id: { $toString: '$item._id' },
            name: '$item.name',
            quantity: '$quantity',
          },
        },
      },
    ]);

    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

router.get('/people', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const { from, to } = getDates();
    const companyIds = getCompanyIds();

    const results = await Order.aggregate([
      {
        $match: {
          status: 'DELIVERED',
          'company._id': { $in: companyIds },
          'delivery.date': { $gte: from, $lte: to },
        },
      },
      {
        $addFields: {
          deliveryDateMS: {
            $toLong: {
              $dateFromString: {
                dateString: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$delivery.date',
                  },
                },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: '$deliveryDateMS',
          customers: { $addToSet: { $toString: '$customer._id' } },
        },
      },
      { $project: { _id: 0, date: '$_id', customers: 1 } },
    ]);

    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

router.get('/restaurant-items', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const results = await Restaurant.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.status': 'ACTIVE' } },
      {
        $project: {
          _id: 0,
          restaurant: '$name',
          name: '$items.name',
          price: '$items.price',
        },
      },
    ]);

    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

router.get('/review', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const results = await Restaurant.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.reviews': { $exists: true, $ne: [] } } },
      { $unwind: '$items.reviews' },
      {
        $lookup: {
          from: 'users',
          localField: 'items.reviews.customer',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $match: { customer: { $exists: true, $ne: null } } },
      { $unwind: '$customer' },
      {
        $project: {
          _id: 0,
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$items.reviews.createdAt',
            },
          },
          restaurant: '$name',
          item: '$items.name',
          rating: '$items.reviews.rating',
          comment: '$items.reviews.comment',
          customer: '$customer.email',
          company: '$customer.companies.0.code',
        },
      },
    ]);

    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
