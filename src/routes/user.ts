import bcrypt from 'bcrypt';
import mail from '@sendgrid/mail';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User from '../models/user';
import auth from '../middleware/auth';
import { setCookie, deleteFields } from '../lib/utils';
import { Router } from 'express';
import { passwordReset, passwordResetConfirmation } from '../lib/emails';
import {
  invalidCredentials,
  invalidEmail,
  requiredFields,
  unAuthorized,
} from '../lib/messages';

const router = Router();

interface LoginPayload {
  email: string;
  password: string;
}

// Login user
router.post('/login', async (req, res) => {
  const { email, password }: LoginPayload = req.body;
  if (!email || !password) {
    console.log(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const user = await User.findOne({ email }).lean().orFail();

    if (!user) {
      console.log(invalidCredentials);
      res.status(403);
      throw new Error(invalidCredentials);
    }

    if (user.role === 'GUEST') {
      console.log(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const correctPassword = await bcrypt.compare(password, user.password);
    if (!correctPassword) {
      console.log(invalidCredentials);
      res.status(403);
      throw new Error(invalidCredentials);
    }

    setCookie(res, user._id);
    deleteFields(user, ['password', 'createdAt']);
    res.status(200).json(user);
  } catch (err) {
    console.log(invalidCredentials);
    res.status(403);
    throw new Error(invalidCredentials);
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
      secure: process.env.NODE_ENV !== 'development',
    })
    .end();
});

// Get user details
router.get('/me', auth, async (req, res) => {
  res.status(200).json(req.user);
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    console.log(invalidEmail);
    res.status(400);
    throw new Error(invalidEmail);
  }

  try {
    const user = await User.findOne({ email }).orFail();

    if (user.role === 'GUEST') {
      console.log(unAuthorized);
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
    console.log(err);
    throw err;
  }
});

// Reset password
router.patch('/reset-password/:userId/:token', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    console.log(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  const { userId, token } = req.params;
  try {
    const user = await User.findById(userId).orFail();

    if (user.role === 'GUEST') {
      console.log(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    if (decoded.password !== user.password) {
      console.log('Invalid token');
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
    console.log(err);
    throw err;
  }
});

export default router;
