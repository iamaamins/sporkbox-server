import User from '../models/user';
import { Router } from 'express';
import Order from '../models/order';
import Company from '../models/company';
import auth from '../middleware/auth';
import { checkActions, checkShift, deleteFields } from '../lib/utils';
import { requiredAction, requiredFields, unAuthorized } from '../lib/messages';

const router = Router();

// Get all companies
router.get('/', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const companies = await Company.find()
      .select('-__v -updatedAt')
      .sort({ createdAt: -1 });

    res.status(201).json(companies);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Add a company
router.post('/add-company', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
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
  } = req.body;
  if (
    !name ||
    !code ||
    !city ||
    !state ||
    !zip ||
    !website ||
    !shiftBudget ||
    !addressLine1
  ) {
    console.log(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }
  if (shift) checkShift(res, shift);

  try {
    const prevCompany = await Company.findOne({ code }).lean();
    if (prevCompany?.shift === shift) {
      console.log('A company with the same shift already exists');
      res.status(400);
      throw new Error('A company with the same shift already exists');
    }
    if (prevCompany?.shift === 'general') {
      console.log('A non-shift company with the same code already exists');
      res.status(400);
      throw new Error('A non-shift company with the same code already exists');
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
      shiftBudget,
      status: 'ACTIVE',
      shift: shift || 'general',
    });
    const company = response.toObject();
    deleteFields(company);
    const { website: companyWebsite, createdAt, ...rest } = company;

    if (shift) {
      await User.updateMany(
        { 'companies.code': code },
        {
          $push: {
            shifts: company.shift,
            companies: { ...rest, status: 'ARCHIVED' },
          },
        }
      );
    }
    res.status(200).json(company);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Update company details
router.patch('/:companyId/update-company-details', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
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
  } = req.body;
  if (
    !zip ||
    !name ||
    !city ||
    !state ||
    !website ||
    !shiftBudget ||
    !addressLine1
  ) {
    console.log(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

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
        },
      }
    );
    deleteFields(updatedCompany);
    res.status(201).json(updatedCompany);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Change company status
router.patch('/:companyId/change-company-status', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { companyId } = req.params;
  const { action } = req.body;

  if (!action) {
    console.log(requiredAction);
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
        console.log("Can't archive a company with active orders");
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

    if (updatedCompany.status === 'ARCHIVED') {
      await User.updateMany(
        {
          'companies._id': updatedCompany._id,
        },
        {
          $pull: {
            shifts: updatedCompany.shift,
          },
          $set: {
            'companies.$.status': updatedCompany.status,
          },
        }
      );
      res.status(200).json(updatedCompany);
    } else if (updatedCompany.status === 'ACTIVE') {
      await User.updateMany(
        { 'companies.code': updatedCompany.code },
        {
          $push: {
            shifts: updatedCompany.shift,
          },
        }
      );
      res.status(200).json(updatedCompany);
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
});

export default router;
