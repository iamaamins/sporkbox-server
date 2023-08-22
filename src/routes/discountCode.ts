import { Router } from 'express';
import authUser from '../middleware/authUser';
import { DiscountCodeSchema } from '../types';
import { deleteFields } from '../utils';
import DiscountCode from '../models/discountCode';

// Types
type DiscountCodePayload = Omit<DiscountCodeSchema, 'totalRedeem'>;

// Initiate router
const router = Router();

// Add a discount code
router.post('/add', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data
    const { role } = req.user;

    if (role === 'ADMIN') {
      // Destructure data
      const { code, value, redeemability }: DiscountCodePayload = req.body;

      // Validation
      if (!code || !value || !redeemability) {
        // Log error
        console.log('Please provide all the fields');

        res.status(400);
        throw new Error('Please provide all the fields');
      }

      try {
        // Create document
        const response = await DiscountCode.create({
          code,
          value,
          redeemability,
        });

        // Convert the response
        const discountCode = response.toObject();

        // Delete fields
        deleteFields(discountCode, ['createdAt']);

        // Send response
        res.status(201).json(discountCode);
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

// Get all discount codes
router.get('/', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data
    const { role } = req.user;

    if (role === 'ADMIN') {
      try {
        // Query database
        const discountCodes = await DiscountCode.find()
          .select('-__v -createdAt -updatedAt')
          .lean();

        // Send response
        res.status(200).json(discountCodes);
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

// Delete a discount code
router.delete('/delete/:id', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data
    const { role } = req.user;

    if (role === 'ADMIN') {
      // Destructure data
      const { id } = req.params;

      try {
        // Delete document
        const deletedCode = await DiscountCode.findByIdAndDelete(id)
          .lean()
          .orFail();

        // Send response
        res.status(200).json(deletedCode._id);
      } catch (err) {
        // Log error
        console.log(err);

        throw err;
      }
    } else {
      // If role isn't Admin
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

export default router;
