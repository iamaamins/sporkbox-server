import bcrypt from 'bcrypt';
import User from '../models/user';
import Company from '../models/company';
import auth from '../middleware/auth';
import {
  setCookie,
  deleteFields,
  checkActions,
  checkShift,
  subscriptions,
} from '../lib/utils';
import { Router } from 'express';
import {
  invalidShift,
  requiredAction,
  requiredFields,
  unAuthorized,
} from '../lib/messages';
import { DIETARY_TAGS } from '../data/DIETARY_TAGS';

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
      '-__v -updatedAt -password -role'
    );
    res.status(200).json(customers);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get customer by id
router.get('/:id', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const customer = await User.findOne({
      _id: req.params.id,
      role: 'CUSTOMER',
    })
      .select('-__v -updatedAt -password -role')
      .lean()
      .orFail();
    res.status(200).json(customer);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Register customer
router.post('/register-customer', async (req, res) => {
  const { firstName, lastName, email, password, companyCode } = req.body;
  if (!firstName || !lastName || !email || !password) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const companies = await Company.find({
      code: companyCode,
      status: 'ACTIVE',
    })
      .select('-updatedAt -createdAt -website')
      .lean()
      .orFail();

    const shifts = [];
    if (!companies.some((company) => company.shift === 'general')) {
      for (const company of companies) {
        if (company.status === 'ACTIVE') {
          shifts.push(company.shift);
        }
        company.status = 'ARCHIVED';
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const response = await User.create({
      firstName,
      lastName,
      email,
      shifts,
      companies,
      status: 'ACTIVE',
      role: 'CUSTOMER',
      password: hashedPassword,
      subscribedTo: subscriptions,
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

// Edit customer details
router.patch('/:customerId/update-customer-details', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { customerId } = req.params;
  const { firstName, lastName, email } = req.body;
  if (!firstName || !lastName || !email) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const updatedCustomer = await User.findOneAndUpdate(
      { _id: customerId },
      {
        firstName,
        lastName,
        email,
      },
      { returnDocument: 'after' }
    )
      .lean()
      .orFail();
    res.status(200).json(updatedCustomer);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Change customer status
router.patch('/:customerId/change-customer-status', auth, async (req, res) => {
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
  checkActions(undefined, action, res);

  try {
    const updatedCustomer = await User.findOneAndUpdate(
      { _id: customerId, role: 'CUSTOMER' },
      {
        status: action === 'Archive' ? 'ARCHIVED' : 'ACTIVE',
      },
      { returnDocument: 'after' }
    )
      .select('-__v -password -updatedAt -role')
      .lean()
      .orFail();

    res.status(201).json(updatedCustomer);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Change customer shift
router.patch(
  '/:customerId/:companyCode/change-customer-shift',
  auth,
  async (req, res) => {
    if (!req.user || req.user.role !== 'CUSTOMER') {
      console.error(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    const { customerId, companyCode } = req.params;
    const { shift } = req.body;
    if (!shift || typeof shift !== 'string') {
      console.error(invalidShift);
      res.status(400);
      throw new Error(invalidShift);
    }
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
    const { isSubscribed } = req.body;

    let updatedSubscriptions = {};
    for (let subscription in subscriptions) {
      updatedSubscriptions = {
        ...updatedSubscriptions,
        [subscription]: !isSubscribed,
      };
    }

    try {
      const updatedCustomer = await User.findByIdAndUpdate(
        customerId,
        {
          $set: {
            subscribedTo: updatedSubscriptions,
          },
        },
        {
          returnDocument: 'after',
        }
      )
        .select('-__v -password -updatedAt -createdAt')
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

export default router;
