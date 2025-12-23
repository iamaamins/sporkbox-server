import User from '../models/user';
import { Router } from 'express';
import Order from '../models/order';
import Company from '../models/company';
import auth from '../middleware/auth';
import {
  checkActions,
  checkShift,
  deleteFields,
  validateURL,
} from '../lib/utils';
import { requiredAction, requiredFields, unAuthorized } from '../lib/messages';

const router = Router();

// Get all companies
router.get('/', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const companies = await Company.find()
      .select('-__v -updatedAt')
      .sort({ createdAt: -1 });

    res.status(201).json(companies);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Add a company
router.post('/add', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const {
    name,
    code,
    zip,
    city,
    state,
    shift,
    website,
    shiftBudget,
    addressLine1,
    addressLine2,
    slackChannel,
  } = req.body;
  if (
    !name ||
    !code ||
    !shift ||
    !city ||
    !state ||
    !zip ||
    !website ||
    !addressLine1
  ) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }
  checkShift(res, shift);
  if (slackChannel) validateURL(res, slackChannel, 'Slack channel');

  try {
    const sameShiftCompany = await Company.findOne({ code, shift }).lean();
    if (sameShiftCompany) {
      console.error('A company with the same shift already exists');
      res.status(400);
      throw new Error('A company with the same shift already exists');
    }

    const response = await Company.create({
      name,
      code,
      website,
      address: {
        city,
        state,
        zip,
        addressLine1,
        addressLine2,
      },
      shift,
      shiftBudget,
      status: 'ACTIVE',
      slackChannel,
    });

    const company = response.toObject();
    deleteFields(company);
    const { website: companyWebsite, createdAt, ...rest } = company;

    await User.updateMany(
      { 'companies.code': code },
      {
        $push: {
          companies: { ...rest, isEnrolled: false, isEnrollAble: true },
        },
      }
    );

    res.status(200).json(company);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Update company details
router.patch('/:companyId/update', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { companyId } = req.params;
  const {
    name,
    city,
    zip,
    state,
    website,
    shiftBudget,
    addressLine1,
    addressLine2,
    slackChannel,
  } = req.body;

  if (!zip || !name || !city || !state || !website || !addressLine1) {
    console.error(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }
  if (slackChannel) validateURL(res, slackChannel, 'Slack channel');

  try {
    const updatedCompany = await Company.findOneAndUpdate(
      { _id: companyId },
      {
        name,
        website,
        address: {
          zip,
          city,
          state,
          addressLine1,
          addressLine2,
        },
        shiftBudget,
        slackChannel,
      },
      { returnDocument: 'after' }
    )
      .lean()
      .orFail();

    await User.updateMany(
      { 'companies._id': companyId },
      {
        $set: {
          'companies.$.name': updatedCompany.name,
          'companies.$.address': updatedCompany.address,
          'companies.$.shiftBudget': updatedCompany.shiftBudget,
          'companies.$.slackChannel': updatedCompany.slackChannel,
        },
      }
    );
    deleteFields(updatedCompany);

    res.status(201).json(updatedCompany);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Update company status
router.patch('/:companyId/update-status', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { companyId } = req.params;
  const { action } = req.body;

  if (!action) {
    console.error(requiredAction);
    res.status(400);
    throw new Error(requiredAction);
  }
  checkActions(undefined, action, res);

  try {
    if (action === 'Archive') {
      const orders = await Order.find({
        status: 'PROCESSING',
        'company._id': companyId,
      })
        .select('_id')
        .lean();

      if (orders.length > 0) {
        console.error("Can't archive a company with active orders");
        res.status(404);
        throw new Error("Can't archive a company with active orders");
      }
    }

    const updatedCompany = await Company.findOneAndUpdate(
      { _id: companyId },
      {
        status: action === 'Archive' ? 'ARCHIVED' : 'ACTIVE',
      },
      { returnDocument: 'after' }
    )
      .select('-__v -updatedAt')
      .lean()
      .orFail();

    await User.updateMany(
      { 'companies._id': companyId },
      {
        $set: {
          'companies.$.status': updatedCompany.status,
          ...(updatedCompany.status === 'ARCHIVED' && {
            'companies.$.isEnrolled': false,
          }),
          'companies.$.isEnrollAble': updatedCompany.status === 'ACTIVE',
        },
      }
    );

    res.status(200).json(updatedCompany);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
