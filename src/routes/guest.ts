import User from '../models/user';
import Company from '../models/company';
import auth from '../middleware/auth';
import { checkActions, deleteFields, generateRandomString } from '../lib/utils';
import { Router } from 'express';
import { requiredAction, requiredFields, unAuthorized } from '../lib/messages';
import bcrypt from 'bcrypt';

const router = Router();

// Get all guests
router.get('/', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const guests = await User.find({ role: 'GUEST' }).select(
      '-__v -updatedAt -password'
    );
    res.status(200).json(guests);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get all guests by company
router.get('/:companyCode', auth, async (req, res) => {
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

  try {
    const guests = await User.find({
      role: 'GUEST',
      'companies.code': req.params.companyCode,
    }).select('-__v -updatedAt -password');

    res.status(200).json(guests);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Add guest
router.post('/add-guest', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { firstName, lastName, email, companyId } = req.body;
  if (!firstName || !lastName || !email || !companyId) {
    console.error(requiredFields);
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
    const password = generateRandomString();
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
    console.error(err);
    throw err;
  }
});

// Change guest status
router.patch('/:guestId/change-guest-status', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { guestId } = req.params;
  const { action } = req.body;
  if (!action) {
    console.error(requiredAction);
    res.status(400);
    throw new Error(requiredAction);
  }
  checkActions(undefined, action, res);

  try {
    const updatedGuest = await User.findOneAndUpdate(
      { _id: guestId, role: 'GUEST' },
      {
        status: action === 'Archive' ? 'ARCHIVED' : 'ACTIVE',
      },
      { returnDocument: 'after' }
    )
      .select('-__v -password -updatedAt -role')
      .lean()
      .orFail();

    res.status(201).json(updatedGuest);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
