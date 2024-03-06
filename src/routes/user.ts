import bcrypt from 'bcrypt';
import mail from '@sendgrid/mail';
import jwt from 'jsonwebtoken';
import User from '../models/user';
import auth from '../middleware/auth';
import { setCookie, deleteFields } from '../lib/utils';
import { Router } from 'express';
import {
  passwordResetTemplate,
  passwordResetConfirmationTemplate,
} from '../lib/emailTemplates';
import {
  invalidCredentials,
  invalidEmail,
  requiredFields,
} from '../lib/messages';

const router = Router();

interface LoginPayload {
  email: string;
  password: string;
}

interface ResetPasswordPayload {
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

    const jwtSecret = process.env.JWT_SECRET + user.password;
    const token = jwt.sign({ _id: user._id }, jwtSecret, { expiresIn: '15m' });
    const link = `${process.env.CLIENT_URL}/reset-password/${user._id}/${token}`;

    await mail.send(passwordResetTemplate(user.toObject(), link));
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
    const jwtSecret = process.env.JWT_SECRET + user.password;
    jwt.verify(token, jwtSecret);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.findOneAndUpdate(
      { _id: userId },
      {
        password: hashedPassword,
      }
    ).orFail();
    await mail.send(passwordResetConfirmationTemplate(user.toObject()));
    res.status(201).json('Password reset successful');
  } catch (err) {
    console.log(err);
    throw err;
  }
});

export default router;
