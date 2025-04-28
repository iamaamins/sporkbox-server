import bcrypt from 'bcrypt';
import User from '../models/user';
import { Router } from 'express';
import { deleteFields } from '../lib/utils';
import auth from '../middleware/auth';
import { requiredFields, unAuthorized } from '../lib/messages';

const router = Router();

// Get admins
router.get('/', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const admins = await User.find({
      role: { $in: ['ADMIN', 'DRIVER'] },
    }).select('-password -__v -companies -foodPreferences -updatedAt -shifts');

    res.status(200).json(admins);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Add admin
router.post('/add-admin', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { firstName, lastName, email, role, password } = req.body;

  if (!firstName || !lastName || !email || !role || !password) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  if (role !== 'ADMIN' && role !== 'DRIVER') {
    console.error('Please provide a valid role');
    res.status(400);
    throw new Error('Please provide a valid role');
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const response = await User.create({
      firstName,
      lastName,
      email,
      role,
      status: 'ACTIVE',
      password: hashedPassword,
    });

    const admin = response.toObject();
    deleteFields(admin, ['createdAt', 'password']);

    res.status(201).json(admin);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
