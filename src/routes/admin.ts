import bcrypt from 'bcrypt';
import User from '../models/user';
import { Router } from 'express';
import { deleteFields } from '../lib/utils';
import auth from '../middleware/auth';
import { requiredFields, unAuthorized } from '../lib/messages';

const router = Router();

// Add admin
router.post('/add-admin', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const response = await User.create({
      firstName,
      lastName,
      email,
      status: 'ACTIVE',
      role: 'ADMIN',
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
