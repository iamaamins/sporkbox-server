import Order from '../models/order';
import Company from '../models/company';
import Restaurant from '../models/restaurant';
import auth from '../middleware/auth';
import { Router } from 'express';
import {
  now,
  sortByDate,
  resizeImage,
  deleteFields,
  checkActions,
  formatAddons,
  dateToMS,
  isCorrectAddonsFormat,
  getUpcomingRestaurants,
} from '../lib/utils';
import { upload } from '../config/multer';
import { deleteImage, uploadImage } from '../config/s3';
import { Addons } from '../types';
import mail from '@sendgrid/mail';
import { orderCancelTemplate } from '../lib/emailTemplates';
import {
  invalidOptionalAddOnsFormat,
  invalidRequiredAddOnsFormat,
  requiredAction,
  requiredFields,
  unAuthorized,
} from '../lib/messages';

interface ItemsIndexPayload {
  reorderedItems: {
    _id: string;
    index: number;
  }[];
}

const router = Router();

// Get upcoming restaurants
router.get('/upcoming-restaurants', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { companies } = req.user;
  if (!companies || companies.length === 0) {
    console.log(unAuthorized);
    res.status(400);
    throw new Error(unAuthorized);
  }

  try {
    const upcomingRestaurants = await getUpcomingRestaurants(companies);
    res.status(200).json(upcomingRestaurants);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Get all scheduled restaurants
router.get('/scheduled-restaurants', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const restaurants = await Restaurant.find({
      'schedules.date': {
        $gte: now,
      },
    }).select('-__v -updatedAt -createdAt -address -items -logo');

    const scheduledRestaurants = [];
    for (const restaurant of restaurants) {
      const { schedules, ...rest } = restaurant.toObject();
      for (const schedule of schedules) {
        if (dateToMS(schedule.date) >= now) {
          const scheduledRestaurant = {
            ...rest,
            company: schedule.company,
            schedule: {
              _id: schedule._id,
              date: schedule.date,
              status: schedule.status,
            },
          };
          scheduledRestaurants.push(scheduledRestaurant);
        }
      }
    }
    scheduledRestaurants.sort(sortByDate);

    res.status(200).json(scheduledRestaurants);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Schedule a restaurant
router.post('/schedule-restaurant', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { date, companyId, restaurantId } = req.body;
  if (!date || !companyId || !restaurantId) {
    console.log(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  if (dateToMS(date) < now) {
    console.log("Cant' schedule on the provided date");
    res.status(400);
    throw new Error("Cant' schedule on the provided date");
  }

  try {
    // Find the restaurant and remove past dates
    const updatedRestaurant = await Restaurant.findOneAndUpdate(
      { _id: restaurantId },
      {
        $pull: {
          schedules: {
            date: { $lt: now },
          },
        },
      },
      {
        returnDocument: 'after',
      }
    )
      .select('-__v -updatedAt -createdAt -address -items -logo')
      .orFail();

    const isScheduled = updatedRestaurant.schedules.some(
      (schedule) =>
        dateToMS(schedule.date) === dateToMS(date) &&
        companyId === schedule.company._id.toString()
    );
    if (isScheduled) {
      console.log('Already scheduled on the provided date');
      res.status(401);
      throw new Error('Already scheduled on the provided date');
    }

    const company = await Company.findById(companyId).orFail();
    const scheduleCompany = {
      _id: company._id,
      name: company.name,
      shift: company.shift,
    };

    const schedule = {
      date,
      status: 'ACTIVE',
      company: scheduleCompany,
    };
    updatedRestaurant.schedules.push(schedule);
    await updatedRestaurant.save();

    const addedSchedule =
      updatedRestaurant.schedules[updatedRestaurant.schedules.length - 1];
    const { schedules, ...rest } = updatedRestaurant.toObject();
    const scheduledRestaurant = {
      ...rest,
      company: scheduleCompany,
      schedule: {
        _id: addedSchedule._id,
        date,
        status: 'ACTIVE',
      },
    };
    deleteFields(scheduledRestaurant);
    res.status(201).json(scheduledRestaurant);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Change schedule status
router.patch(
  '/:restaurantId/:scheduleId/change-schedule-status',
  auth,
  async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      console.log(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const { restaurantId, scheduleId } = req.params;
    const { action } = req.body;
    if (!action) {
      console.log(requiredAction);
      res.status(400);
      throw new Error(requiredAction);
    }
    checkActions(['Activate', 'Deactivate'], action, res);

    try {
      const restaurant = await Restaurant.findOne({
        _id: restaurantId,
        'schedules._id': scheduleId,
      })
        .select('-__v -updatedAt -createdAt -address -items')
        .orFail();

      const schedule = restaurant.schedules.find(
        (schedule) => schedule._id?.toString() === scheduleId
      );
      if (!schedule) {
        res.status(400);
        throw new Error('No schedule found');
      }

      if (action === 'Deactivate') schedule.deactivatedByAdmin = true;
      if (action === 'Activate' && schedule.deactivatedByAdmin) {
        await Restaurant.updateOne(
          { _id: restaurantId, 'schedules._id': scheduleId },
          { $unset: { 'schedules.$.deactivatedByAdmin': 1 } }
        );
      }
      schedule.status = action === 'Deactivate' ? 'INACTIVE' : 'ACTIVE';
      await restaurant.save();

      const schedules = restaurant.schedules.map((schedule) => ({
        _id: schedule._id,
        status: schedule.status,
        date: schedule.date,
      }));
      res.status(201).json(schedules);
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
);

// Remove a schedule
router.patch(
  '/:restaurantId/:scheduleId/remove-schedule',
  auth,
  async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      console.log(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const { restaurantId, scheduleId } = req.params;
    try {
      // Find the restaurant and remove the schedule
      const updatedRestaurant = await Restaurant.findOneAndUpdate(
        { _id: restaurantId },
        {
          $pull: {
            schedules: { _id: scheduleId },
          },
        }
      )
        .select('-__v -updatedAt -createdAt -address -items')
        .lean()
        .orFail();

      const removedSchedule = updatedRestaurant.schedules.find(
        (schedule) => schedule._id?.toString() === scheduleId
      );
      if (!removedSchedule) {
        console.log('Please provide a valid schedule');
        res.status(400);
        throw new Error('Please provide a valid schedule');
      }

      const orders = await Order.find({
        status: 'PROCESSING',
        'delivery.date': removedSchedule.date,
        'restaurant._id': updatedRestaurant._id,
        'company._id': removedSchedule.company._id,
      });

      await Promise.all(
        orders.map(
          async (order) =>
            await mail.send(orderCancelTemplate(order.toObject()))
        )
      );
      await Order.updateMany(
        {
          status: 'PROCESSING',
          'restaurant._id': updatedRestaurant._id,
          'delivery.date': removedSchedule.date,
          'company._id': removedSchedule.company._id,
        },
        {
          $set: { status: 'ARCHIVED' },
        }
      );
      res.status(201).json('Schedule and orders removed successfully');
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
);

// Cerate an item
router.post('/:restaurantId/add-item', auth, upload, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { restaurantId } = req.params;
  const {
    name,
    tags,
    price,
    index,
    description,
    optionalAddons,
    requiredAddons,
    removableIngredients,
  } = req.body;
  if (
    !name ||
    !tags ||
    !price ||
    !index ||
    !description ||
    !optionalAddons ||
    !requiredAddons ||
    !removableIngredients
  ) {
    console.log(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  const parsedOptionalAddons: Addons = JSON.parse(optionalAddons);
  const parsedRequiredAddons: Addons = JSON.parse(requiredAddons);

  if (
    parsedOptionalAddons.addons &&
    !isCorrectAddonsFormat(parsedOptionalAddons)
  ) {
    console.log(invalidOptionalAddOnsFormat);
    res.status(400);
    throw new Error(invalidOptionalAddOnsFormat);
  }
  if (
    parsedRequiredAddons.addons &&
    !isCorrectAddonsFormat(parsedRequiredAddons)
  ) {
    console.log(invalidRequiredAddOnsFormat);
    res.status(400);
    throw new Error(invalidRequiredAddOnsFormat);
  }

  let imageUrl;
  if (req.file) {
    const { buffer, mimetype } = req.file;
    const modifiedBuffer = await resizeImage(res, buffer, 800, 500);
    imageUrl = await uploadImage(res, modifiedBuffer, mimetype);
  }

  const formattedOptionalAddons =
    parsedOptionalAddons.addons && formatAddons(parsedOptionalAddons);
  const formattedRequiredAddons =
    parsedRequiredAddons.addons && formatAddons(parsedRequiredAddons);

  try {
    const updatedRestaurant = await Restaurant.findOneAndUpdate(
      { _id: restaurantId },
      {
        $push: {
          items: {
            name,
            tags,
            price,
            index,
            description,
            image: imageUrl,
            status: 'ACTIVE',
            removableIngredients,
            optionalAddons: formattedOptionalAddons || parsedOptionalAddons,
            requiredAddons: formattedRequiredAddons || parsedRequiredAddons,
          },
        },
      },
      {
        returnDocument: 'after',
      }
    )
      .select('-__v -updatedAt')
      .lean()
      .orFail();

    res.status(201).json(updatedRestaurant);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Edit an item
router.patch(
  '/:restaurantId/:itemId/update-item-details',
  auth,
  upload,
  async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      console.log(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const { restaurantId, itemId } = req.params;
    const {
      name,
      tags,
      price,
      image,
      description,
      optionalAddons,
      requiredAddons,
      removableIngredients,
    } = req.body;
    if (
      !name ||
      !tags ||
      !price ||
      !description ||
      !optionalAddons ||
      !requiredAddons ||
      !removableIngredients
    ) {
      console.log(requiredFields);
      res.status(400);
      throw new Error(requiredFields);
    }

    const parsedOptionalAddons: Addons = JSON.parse(optionalAddons);
    const parsedRequiredAddons: Addons = JSON.parse(requiredAddons);

    if (
      parsedOptionalAddons.addons &&
      !isCorrectAddonsFormat(parsedOptionalAddons)
    ) {
      console.log(invalidOptionalAddOnsFormat);
      res.status(400);
      throw new Error(invalidOptionalAddOnsFormat);
    }
    if (
      parsedRequiredAddons.addons &&
      !isCorrectAddonsFormat(parsedRequiredAddons)
    ) {
      console.log(invalidRequiredAddOnsFormat);
      res.status(400);
      throw new Error(invalidRequiredAddOnsFormat);
    }

    if (req.file && image) {
      const name = image.split('/')[image.split('/').length - 1];
      await deleteImage(res, name);
    }

    let imageUrl = image;
    if (req.file) {
      const { buffer, mimetype } = req.file;
      const modifiedBuffer = await resizeImage(res, buffer, 800, 500);
      imageUrl = await uploadImage(res, modifiedBuffer, mimetype);
    }

    const formattedOptionalAddons =
      parsedOptionalAddons.addons && formatAddons(parsedOptionalAddons);
    const formattedRequiredAddons =
      parsedRequiredAddons.addons && formatAddons(parsedRequiredAddons);

    try {
      if (!imageUrl) {
        const updatedRestaurant = await Restaurant.findOneAndUpdate(
          { _id: restaurantId, 'items._id': itemId },
          {
            $set: {
              'items.$.name': name,
              'items.$.tags': tags,
              'items.$.price': price,
              'items.$.description': description,
              'items.$.optionalAddons':
                formattedOptionalAddons || parsedOptionalAddons,
              'items.$.requiredAddons':
                formattedRequiredAddons || parsedRequiredAddons,
              'items.$.removableIngredients': removableIngredients,
            },
            $unset: {
              'items.$.image': null,
            },
          },
          {
            returnDocument: 'after',
          }
        )
          .lean()
          .orFail();

        deleteFields(updatedRestaurant, ['createdAt']);
        res.status(201).json(updatedRestaurant);
      } else if (imageUrl) {
        const updatedRestaurant = await Restaurant.findOneAndUpdate(
          { _id: restaurantId, 'items._id': itemId },
          {
            $set: {
              'items.$.name': name,
              'items.$.tags': tags,
              'items.$.price': price,
              'items.$.image': imageUrl,
              'items.$.description': description,
              'items.$.optionalAddons':
                formattedOptionalAddons || parsedOptionalAddons,
              'items.$.requiredAddons':
                formattedRequiredAddons || parsedRequiredAddons,
              'items.$.removableIngredients': removableIngredients,
            },
          },
          {
            returnDocument: 'after',
          }
        )
          .lean()
          .orFail();

        deleteFields(updatedRestaurant, ['createdAt']);
        res.status(201).json(updatedRestaurant);
      }
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
);

// Change item status
router.patch(
  '/:restaurantId/:itemId/change-item-status',
  auth,
  async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      console.log(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const { restaurantId, itemId } = req.params;
    const { action } = req.body;
    if (!action) {
      console.log(requiredAction);
      res.status(400);
      throw new Error(requiredAction);
    }
    checkActions(undefined, action, res);

    try {
      const updatedRestaurant = await Restaurant.findOneAndUpdate(
        { _id: restaurantId, 'items._id': itemId },
        {
          $set: {
            'items.$.status': action === 'Archive' ? 'ARCHIVED' : 'ACTIVE',
          },
        },
        {
          returnDocument: 'after',
        }
      )
        .select('-__v -updatedAt')
        .lean()
        .orFail();
      res.status(200).json(updatedRestaurant);
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
);

// Review item
router.post('/:restaurantId/:itemId/add-a-review', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { restaurantId, itemId } = req.params;
  const { rating, comment, orderId } = req.body;
  if (!rating || !comment || !orderId) {
    console.log(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  const { _id } = req.user;
  try {
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        hasReviewed: false,
        status: 'DELIVERED',
        'customer._id': _id,
      },
      { $set: { hasReviewed: true } },
      {
        returnDocument: 'after',
      }
    ).orFail();
    const restaurant = await Restaurant.findOneAndUpdate(
      {
        _id: restaurantId,
        'items._id': itemId,
      },
      {
        $push: {
          'items.$.reviews': { customer: _id, rating, comment },
        },
      }
    ).orFail();

    // Update average rating on a random interval
    const updateFrequency = 1;
    const randomFrequency = Math.floor(Math.random() * updateFrequency) + 1;
    const item = restaurant.items.find(
      (item) => item._id.toString() === itemId
    );

    if (item && updateFrequency === randomFrequency) {
      const totalRating = item.reviews.reduce(
        (acc, curr) => acc + curr.rating,
        0
      );
      const averageRating = (
        (totalRating + rating * updateFrequency) /
        (item.reviews.length + updateFrequency)
      ).toFixed(2);

      await Restaurant.findOneAndUpdate(
        {
          _id: restaurantId,
          'items._id': itemId,
        },
        {
          $set: {
            'items.$.averageRating': +averageRating,
          },
        }
      );
    }
    res.status(201).json(order);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Update items index
router.patch('/:restaurantId/update-items-index', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { restaurantId } = req.params;
  const { reorderedItems }: ItemsIndexPayload = req.body;

  try {
    reorderedItems.forEach(async (item) => {
      await Restaurant.updateOne(
        { _id: restaurantId, 'items._id': item._id },
        { $set: { 'items.$.index': item.index } }
      );
    });
    res.status(200).json('Items order updated');
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Get a vendor restaurant
router.get('/:id', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { id } = req.params;
  try {
    const restaurant = await Restaurant.findById(id)
      .select('-__v -createdAt -updatedAt -items')
      .lean()
      .orFail();
    res.status(200).json(restaurant);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

export default router;
