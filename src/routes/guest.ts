import User from '../models/user';
import Company from '../models/company';
import auth from '../middleware/auth';
import { deleteFields } from '../lib/utils';
import { Router } from 'express';
import { requiredFields, unAuthorized } from '../lib/messages';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

const router = Router();

// Add guest
router.post('/add-guest', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { firstName, lastName, email, companyId } = req.body;
  if (!firstName || !lastName || !email || !companyId) {
    console.log(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const company = await Company.findOne({
      _id: companyId,
      status: 'ACTIVE',
    })
      .select('-updatedAt -createdAt -website')
      .lean()
      .orFail();

    const salt = await bcrypt.genSalt(10);
    const password = randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(password, salt);

    const response = await User.create({
      firstName,
      lastName,
      email,
      role: 'GUEST',
      status: 'ACTIVE',
      companies: [company],
      password: hashedPassword,
    });

    const guest = response.toObject();
    deleteFields(guest, ['createdAt', 'password']);
    res.status(201).json(guest);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

export default router;
