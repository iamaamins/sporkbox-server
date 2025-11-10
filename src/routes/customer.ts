import bcrypt from 'bcrypt';
import User from '../models/user';
import Company from '../models/company';
import auth from '../middleware/auth';
import {
  setCookie,
  deleteFields,
  checkShift,
  checkActions,
} from '../lib/utils';
import { Router } from 'express';
import {
  invalidShift,
  requiredAction,
  requiredFields,
  unAuthorized,
} from '../lib/messages';
import { DIETARY_TAGS } from '../data/DIETARY_TAGS';
import {
  EMAIL_SUBSCRIPTIONS,
  EmailSubscriptions,
} from '../data/EMAIL_SUBSCRIPTIONS';

const router = Router();

// Get all customers
router.get('/', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const customers = await User.find({ role: 'CUSTOMER' }).select(
      '-__v -updatedAt -password'
    );

    res.status(200).json(customers);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get all customers by company
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
    const customers = await User.find({
      role: 'CUSTOMER',
      'companies.code': req.params.companyCode,
    }).select('-__v -updatedAt -password');

    res.status(200).json(customers);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Register customer
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password, companyCode } = req.body;
  if (!firstName || !lastName || !email || !password) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const activeCompanies = await Company.find({
      code: companyCode,
      status: 'ACTIVE',
    })
      .select('-updatedAt -createdAt -website')
      .lean()
      .orFail();

    if (
      activeCompanies.length > 1 &&
      !activeCompanies.some((company) => company.shift === 'GENERAL')
    ) {
      for (const company of activeCompanies) company.status = 'ARCHIVED';
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const response = await User.create({
      firstName,
      lastName,
      email,
      status: 'ACTIVE',
      role: 'CUSTOMER',
      companies: activeCompanies,
      password: hashedPassword,
      subscribedTo: EMAIL_SUBSCRIPTIONS,
    });
    const customer = response.toObject();

    setCookie(res, customer._id);
    deleteFields(customer, ['createdAt', 'password']);

    res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Update customer shift
router.patch(
  '/:customerId/:companyCode/update-shift',
  auth,
  async (req, res) => {
    if (!req.user || req.user.role !== 'CUSTOMER') {
      console.error(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const { customerId, companyCode } = req.params;
    const { shift } = req.body;

    checkShift(res, shift);

    try {
      const response = await Company.find({
        code: companyCode,
      })
        .select('-__v -updatedAt -createdAt -website')
        .lean()
        .orFail();

      const activeCompanies = response.filter(
        (company) => company.status === 'ACTIVE'
      );
      if (
        !activeCompanies.some((activeCompany) => activeCompany.shift === shift)
      ) {
        console.error(invalidShift);
        res.status(404);
        throw new Error(invalidShift);
      }

      const updatedCompanies = activeCompanies.map((company) =>
        company.shift === shift ? company : { ...company, status: 'ARCHIVED' }
      );
      const archivedCompanies = response.filter(
        (company) => company.status !== 'ACTIVE'
      );
      const companies = [...archivedCompanies, ...updatedCompanies];

      await User.findByIdAndUpdate(
        { _id: customerId },
        { $set: { companies: companies } }
      ).orFail();

      res.status(201).json(companies);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
);

// Update customer email subscriptions
router.patch(
  '/:customerId/update-email-subscriptions',
  auth,
  async (req, res) => {
    if (!req.user || req.user.role !== 'CUSTOMER') {
      console.error(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const { customerId } = req.params;
    const { emailSubscriptions } = req.body;

    if (!emailSubscriptions) {
      console.error('Email subscriptions are required');
      res.status(400);
      throw new Error('Email subscriptions are required');
    }

    for (const key in emailSubscriptions) {
      if (!EMAIL_SUBSCRIPTIONS[key as keyof EmailSubscriptions]) {
        console.error('Invalid email subscriptions');
        res.status(400);
        throw new Error('Invalid email subscriptions');
      }
    }

    try {
      const updatedCustomer = await User.findByIdAndUpdate(
        customerId,
        { $set: { subscribedTo: emailSubscriptions } },
        { returnDocument: 'after' }
      )
        .select('subscribedTo')
        .lean()
        .orFail();

      res.status(201).json(updatedCustomer);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
);

// Update customer food preferences
router.patch('/:customerId/update-food-preferences', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { customerId } = req.params;
  const { preferences } = req.body;

  const isValidPreferences = preferences.every(
    (preference: (typeof DIETARY_TAGS)[number]) =>
      DIETARY_TAGS.includes(preference)
  );

  if (!isValidPreferences) {
    console.error('One or more invalid preferences');
    res.status(400);
    throw new Error('One or more  invalid preferences');
  }

  try {
    const updatedCustomer = await User.findByIdAndUpdate(
      customerId,
      {
        $set: { foodPreferences: preferences },
      },
      { returnDocument: 'after' }
    )
      .select('-__v -password -updatedAt -createdAt')
      .lean()
      .orFail();

    res.status(200).json(updatedCustomer);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Update company admin
router.patch('/:customerId/update-company-admin', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { customerId } = req.params;
  const { action } = req.body;

  if (!action) {
    console.error(requiredAction);
    res.status(400);
    throw new Error(requiredAction);
  }
  checkActions(['Make', 'Remove'], action, res);

  try {
    const updatedCustomer = await User.findOneAndUpdate(
      { _id: customerId, role: 'CUSTOMER', status: 'ACTIVE' },
      {
        ...(action === 'Make'
          ? { $set: { isCompanyAdmin: true } }
          : { $unset: { isCompanyAdmin: '' } }),
      },
      { returnDocument: 'after' }
    )
      .select('-__v -password -updatedAt')
      .lean()
      .orFail();

    res.status(201).json(updatedCustomer);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
