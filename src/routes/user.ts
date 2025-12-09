import bcrypt from 'bcrypt';
import mail from '@sendgrid/mail';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User from '../models/user';
import auth from '../middleware/auth';
import { setCookie, deleteFields, checkActions, isLocal } from '../lib/utils';
import { Router } from 'express';
import { passwordReset, passwordResetConfirmation } from '../lib/emails';
import {
  invalidCredentials,
  invalidEmail,
  requiredFields,
  unAuthorized,
} from '../lib/messages';
import Order from '../models/order';

const router = Router();

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const user = await User.findOne({ email }).lean();

    if (!user) {
      console.error(invalidCredentials);
      res.status(401);
      throw new Error(invalidCredentials);
    }

    if (user.status !== 'ACTIVE' || user.role === 'GUEST') {
      console.error(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const correctPassword = await bcrypt.compare(password, user.password);
    if (!correctPassword) {
      console.error(invalidCredentials);
      res.status(401);
      throw new Error(invalidCredentials);
    }

    setCookie(res, user._id);
    deleteFields(user, ['password', 'createdAt']);

    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Log out user
router.post('/logout', async (req, res) => {
  res
    .clearCookie('token', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'strict',
      secure: !isLocal,
    })
    .end();
});

// Get self details
router.get('/me', auth, async (req, res) => {
  res.status(200).json(req.user);
});

// Get user by id
router.get('/:id', auth, async (req, res) => {
  if (
    !req.user ||
    (req.user.role !== 'ADMIN' &&
      (req.user.role !== 'CUSTOMER' || !req.user.isCompanyAdmin))
  ) {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const customer = await User.findOne({
      _id: req.params.id,
    })
      .select('-__v -updatedAt -password')
      .lean()
      .orFail();

    res.status(200).json(customer);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    console.error(invalidEmail);
    res.status(400);
    throw new Error(invalidEmail);
  }

  try {
    const user = await User.findOne({ email, status: 'ACTIVE' }).orFail();

    if (user.role === 'GUEST') {
      console.error(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const token = jwt.sign(
      { password: user.password },
      process.env.JWT_SECRET as string,
      { expiresIn: '15m' }
    );
    const link = `${process.env.CLIENT_URL}/reset-password/${user._id}/${token}`;

    await mail.send(passwordReset(user.toObject(), link));
    res.status(200).json('Password reset details sent to your email');
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Reset password
router.patch('/reset-password/:userId/:token', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  const { userId, token } = req.params;
  try {
    const user = await User.findById(userId).orFail();

    if (user.role === 'GUEST') {
      console.error(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    if (decoded.password !== user.password) {
      console.error('Invalid token');
      res.status(400);
      throw new Error('Invalid token');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.findOneAndUpdate(
      { _id: userId },
      {
        password: hashedPassword,
      }
    ).orFail();

    await mail.send(passwordResetConfirmation(user.toObject()));
    res.status(201).json('Password reset successful');
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Change password
router.patch('/change-password', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const user = await User.findById(req.user._id).orFail();

    const correctPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!correctPassword) {
      console.error(invalidCredentials);
      res.status(401);
      throw new Error(invalidCredentials);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findOneAndUpdate(
      { _id: req.user._id },
      { password: hashedPassword }
    ).orFail();

    res.status(201).json('Password changed successfully');
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Update user status
router.patch('/:userId/update-status', auth, async (req, res) => {
  if (
    !req.user ||
    (req.user.role !== 'ADMIN' &&
      (req.user.role !== 'CUSTOMER' || !req.user.isCompanyAdmin))
  ) {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { userId } = req.params;
  const { action } = req.body;

  if (!action) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }
  checkActions(undefined, action, res);

  try {
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { status: action === 'Archive' ? 'ARCHIVED' : 'ACTIVE' },
      { returnDocument: 'after' }
    )
      .select('-__v -password -updatedAt')
      .lean()
      .orFail();

    res.status(201).json(updatedUser);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Update user details
router.patch('/:userId/update', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { userId } = req.params;
  const { firstName, lastName, email } = req.body;

  if (!firstName || !lastName || !email) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      {
        firstName,
        lastName,
        email,
      },
      { returnDocument: 'after' }
    )
      .lean()
      .orFail();

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get user of a company
router.get('/:companyCode/:userId/data', auth, async (req, res) => {
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

  const { companyCode, userId } = req.params;
  try {
    const user = await User.findOne({
      _id: userId,
      'companies.code': companyCode,
    })
      .select('-__v -updatedAt -password')
      .lean();

    const upcomingOrders = await Order.find({
      status: 'PROCESSING',
      'customer._id': userId,
      'company.code': companyCode,
    })
      .sort({ 'delivery.date': -1 })
      .select('-__v -updatedAt');

    const deliveredOrders = await Order.find({
      status: 'DELIVERED',
      'customer._id': userId,
      'company.code': companyCode,
    })
      .sort({ 'delivery.date': -1 })
      .select('-__v -updatedAt');

    res.status(200).json({ data: user, upcomingOrders, deliveredOrders });
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
