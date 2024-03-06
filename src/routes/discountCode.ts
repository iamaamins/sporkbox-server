import { Router } from 'express';
import auth from '../middleware/auth';
import { deleteFields } from '../lib/utils';
import DiscountCode from '../models/discountCode';
import { requiredFields, unAuthorized } from '../lib/messages';

const router = Router();

// Add a discount code
router.post('/add', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { code, value, redeemability } = req.body;
  if (!code || !value || !redeemability) {
    console.log(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const response = await DiscountCode.create({
      code,
      value,
      redeemability,
    });
    const discountCode = response.toObject();
    deleteFields(discountCode, ['createdAt']);
    res.status(201).json(discountCode);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Get all discount codes
router.get('/', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const discountCodes = await DiscountCode.find()
      .select('-__v -createdAt -updatedAt')
      .lean();
    res.status(200).json(discountCodes);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Delete a discount code
router.delete('/delete/:id', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { id } = req.params;
  try {
    const deletedCode = await DiscountCode.findByIdAndDelete(id)
      .lean()
      .orFail();
    res.status(200).json(deletedCode._id);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Apply discount code
router.post('/apply/:code', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { code } = req.params;
  try {
    const discountCode = await DiscountCode.findOne({ code })
      .select('-__v -createdAt -updatedAt')
      .lean()
      .orFail();
    const redeemability = discountCode.redeemability;

    if (
      redeemability === 'unlimited' ||
      (redeemability === 'once' && discountCode.totalRedeem < 1)
    ) {
      const { redeemability, ...rest } = discountCode;
      res.status(200).json(rest);
    } else {
      console.log('Invalid discount code');
      res.status(400).json({ message: 'Invalid discount code' });
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
});

export default router;
