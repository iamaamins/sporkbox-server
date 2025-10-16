import bcrypt from 'bcrypt';
import User from '../models/user';
import { Router } from 'express';
import { upload } from './../config/multer';
import Restaurant from '../models/restaurant';
import auth from '../middleware/auth';
import { deleteImage, uploadImage } from '../config/s3';
import { Address, GenericUser, RestaurantSchema } from '../types';
import {
  setCookie,
  deleteFields,
  checkActions,
  resizeImage,
  dateToMS,
  getTodayTimestamp,
} from '../lib/utils';
import {
  requiredAction,
  requiredFields,
  requiredLogo,
  unAuthorized,
  vendorAlreadyExists,
} from '../lib/messages';

const router = Router();

interface VendorPayload extends GenericUser, Address {
  password?: string;
  logo?: string;
  orderCapacity: number;
  isFeatured: boolean;
  restaurantName: string;
}

// Register a vendor and a restaurant
router.post('/register', upload, async (req, res) => {
  const {
    zip,
    city,
    state,
    email,
    lastName,
    password,
    firstName,
    isFeatured,
    addressLine1,
    addressLine2,
    orderCapacity,
    restaurantName,
  }: VendorPayload = req.body;
  if (
    !zip ||
    !city ||
    !email ||
    !state ||
    !password ||
    !lastName ||
    !firstName ||
    !isFeatured ||
    !addressLine1 ||
    !restaurantName
  ) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  if (!req.file) {
    console.error(requiredLogo);
    res.status(400);
    throw new Error(requiredLogo);
  }

  try {
    const vendorExists = await User.findOne({ email }).lean();
    if (vendorExists) {
      console.error(vendorAlreadyExists);
      res.status(400);
      throw new Error(vendorAlreadyExists);
    }

    const { buffer, mimetype } = req.file;
    const modifiedBuffer = await resizeImage(res, buffer, 800, 500);
    const logoUrl = await uploadImage(res, modifiedBuffer, mimetype);

    const status = 'ARCHIVED';

    const restaurant = await Restaurant.create({
      name: restaurantName,
      logo: logoUrl,
      isFeatured,
      address: {
        city,
        state,
        zip,
        addressLine1,
        addressLine2,
      },
      status,
      orderCapacity: orderCapacity || Infinity,
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const response = await User.create({
      firstName,
      lastName,
      email,
      role: 'VENDOR',
      status,
      password: hashedPassword,
      restaurant: restaurant.id,
    });

    const vendorWithRestaurant = await response.populate(
      'restaurant',
      '-__v -createdAt -updatedAt'
    );
    const vendor = vendorWithRestaurant.toObject();

    setCookie(res, vendor._id);
    deleteFields(vendor, ['createdAt', 'password']);

    res.status(200).json(vendor);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Add a vendor and a restaurant
router.post('/add', auth, upload, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const {
    zip,
    city,
    state,
    email,
    password,
    lastName,
    firstName,
    isFeatured,
    addressLine1,
    addressLine2,
    orderCapacity,
    restaurantName,
  } = req.body;
  if (
    !zip ||
    !city ||
    !state ||
    !email ||
    !lastName ||
    !password ||
    !firstName ||
    !isFeatured ||
    !addressLine1 ||
    !restaurantName
  ) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  if (!req.file) {
    console.error(requiredLogo);
    res.status(400);
    throw new Error(requiredLogo);
  }

  try {
    const vendorExists = await User.findOne({ email }).lean();
    if (vendorExists) {
      console.error(vendorAlreadyExists);
      res.status(400);
      throw new Error(vendorAlreadyExists);
    }

    const { buffer, mimetype } = req.file;
    const modifiedBuffer = await resizeImage(res, buffer, 800, 500);
    const logoUrl = await uploadImage(res, modifiedBuffer, mimetype);

    const status = 'ARCHIVED';

    const restaurant = await Restaurant.create({
      name: restaurantName,
      logo: logoUrl,
      isFeatured,
      address: {
        city,
        state,
        zip,
        addressLine1,
        addressLine2,
      },
      status,
      orderCapacity: orderCapacity || Infinity,
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const response = await User.create({
      firstName,
      lastName,
      email,
      role: 'VENDOR',
      status,
      password: hashedPassword,
      restaurant: restaurant.id,
    });

    const vendorWithRestaurant = await response.populate(
      'restaurant',
      '-__v -updatedAt'
    );
    const vendor = vendorWithRestaurant.toObject();
    deleteFields(vendor, ['createdAt', 'password']);

    res.status(200).json(vendor);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get all the vendors
router.get('/:limit', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { limit } = req.params;
  try {
    const vendors = await User.find({ role: 'VENDOR' })
      .limit(+limit)
      .select('-__v -password -shifts -companies -createdAt -updatedAt')
      .sort({ createdAt: -1 })
      .populate<{ restaurant: RestaurantSchema }>(
        'restaurant',
        '-__v -updatedAt'
      );

    vendors.forEach((vendor) => {
      vendor.restaurant.items.sort((a, b) => a.index - b.index);
      vendor.restaurant.items.forEach((item) => {
        item.reviews.sort(
          (a, b) => dateToMS(b.createdAt) - dateToMS(a.createdAt)
        );
      });
    });
    res.status(200).json(vendors);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Update a vendor
router.patch('/:vendorId/update', auth, upload, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { vendorId } = req.params;
  const {
    zip,
    city,
    logo,
    email,
    state,
    firstName,
    lastName,
    isFeatured,
    addressLine1,
    addressLine2,
    orderCapacity,
    restaurantName,
  } = req.body;
  if (
    !zip ||
    !city ||
    !email ||
    !state ||
    !lastName ||
    !firstName ||
    !isFeatured ||
    !addressLine1 ||
    !restaurantName
  ) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  let logoUrl;
  if (req.file && logo) {
    const name = logo.split('/')[logo.split('/').length - 1];
    await deleteImage(res, name);
    const { buffer, mimetype } = req.file;
    const modifiedBuffer = await resizeImage(res, buffer, 800, 500);
    logoUrl = await uploadImage(res, modifiedBuffer, mimetype);
  }

  try {
    const updatedVendor = await User.findOneAndUpdate(
      { _id: vendorId },
      {
        email,
        lastName,
        firstName,
      },
      { returnDocument: 'after' }
    )
      .lean()
      .orFail();

    const updatedRestaurant = await Restaurant.findOneAndUpdate(
      { _id: updatedVendor.restaurant._id },
      {
        name: restaurantName,
        logo: logoUrl,
        isFeatured,
        address: {
          city,
          state,
          zip,
          addressLine1,
          addressLine2,
        },
        orderCapacity: orderCapacity || Infinity,
      },
      { returnDocument: 'after' }
    )
      .lean()
      .orFail();

    deleteFields(updatedRestaurant, ['createdAt']);
    deleteFields(updatedVendor, ['createdAt', 'password']);

    const updatedVendorAndRestaurant = {
      ...updatedVendor,
      restaurant: updatedRestaurant,
    };

    res.status(201).json(updatedVendorAndRestaurant);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Change vendor and restaurant status
router.patch('/:vendorId/update-status', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { vendorId } = req.params;
  const { action } = req.body;
  if (!action) {
    console.error(requiredAction);
    res.status(400);
    throw new Error(requiredAction);
  }
  checkActions(undefined, action, res);

  try {
    const vendor = await User.findById(vendorId)
      .select('restaurant')
      .populate<{ restaurant: RestaurantSchema }>('restaurant', 'schedules')
      .lean()
      .orFail();

    console.log(vendor);

    if (
      action === 'Archive' &&
      vendor.restaurant.schedules.some(
        (schedule) =>
          schedule.status === 'ACTIVE' &&
          dateToMS(schedule.date) > getTodayTimestamp()
      )
    ) {
      console.error("Can't archive a vendor with scheduled restaurant");
      res.status(400);
      throw new Error("Can't archive a vendor with scheduled restaurant");
    }

    const updatedVendor = await User.findOneAndUpdate(
      { _id: vendorId },
      { status: action === 'Archive' ? 'ARCHIVED' : 'ACTIVE' },
      { returnDocument: 'after' }
    )
      .select('-__v -password -updatedAt')
      .populate('restaurant', '-__v -updatedAt')
      .lean()
      .orFail();

    await Restaurant.findOneAndUpdate(
      { _id: updatedVendor.restaurant },
      { status: updatedVendor.status }
    );

    res.status(200).json(updatedVendor);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
