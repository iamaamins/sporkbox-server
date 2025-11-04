import { Router } from 'express';
import auth from '../middleware/auth';
import Feedback from '../models/feedback';
import { ISSUE_CATEGORIES } from '../data/FEEDBACK';
import { unAuthorized } from '../lib/messages';
import Restaurant from '../models/restaurant';
import Order from '../models/order';
import { resizeImage, toUSNumber } from '../lib/utils';
import { upload } from '../config/multer';
import { uploadImage } from '../config/s3';

const router = Router();

// Add a general feedback
router.post('/general', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    console.error('Rating must be between 1 and 5');
    res.status(400);
    throw new Error('Rating must be between 1 and 5');
  }

  try {
    await Feedback.create({
      customer: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
      type: 'GENERAL',
      rating,
    });

    res.status(200).json('Feedback submitted');
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Add an issue feedback
router.post('/issue', auth, upload, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { category, date, restaurant, message } = req.body;
  if (
    !category ||
    !date ||
    !restaurant ||
    !message ||
    !ISSUE_CATEGORIES.includes(category)
  ) {
    console.error('Issue category, date, restaurant and message are required');
    res.status(400);
    throw new Error(
      'Issue category, date, restaurant and message are required'
    );
  }

  try {
    let imageUrl;
    if (req.file) {
      const { buffer, mimetype } = req.file;
      const modifiedBuffer = await resizeImage(res, buffer, 800, 500);
      imageUrl = await uploadImage(res, modifiedBuffer, mimetype);
    }

    const issue = {
      category,
      date,
      message,
      status: 'PENDING',
      ...(imageUrl && { image: imageUrl }),
    };

    const customer = {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
    };

    if (restaurant === 'Not Applicable') {
      await Feedback.create({
        customer,
        type: 'ISSUE',
        issue: { ...issue, restaurant: null },
      });
    } else {
      const response = await Restaurant.findOne({
        _id: restaurant,
        status: 'ACTIVE',
      })
        .select('name')
        .lean()
        .orFail();

      await Feedback.create({
        customer,
        type: 'ISSUE',
        issue: {
          ...issue,
          restaurant: { _id: response._id, name: response.name },
        },
      });
    }

    res.status(200).json('Issue submitted');
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Validate or reject an issue
router.patch('/issue/:id/:action', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { id, action } = req.params;
  const { auditNote } = req.body;

  if (!['validate', 'reject'].includes(action)) {
    console.error('Invalid action');
    res.status(400);
    throw new Error('Invalid action');
  }

  if (!auditNote) {
    console.error('Audit note is required');
    res.status(400);
    throw new Error('Audit note is required');
  }

  try {
    const updatedIssue = await Feedback.findOneAndUpdate(
      {
        _id: id,
        type: 'ISSUE',
        'issue.status': 'PENDING',
      },
      {
        $set: {
          'issue.status': action === 'validate' ? 'VALIDATED' : 'REJECTED',
          'issue.audit': {
            note: auditNote,
            auditedBy: {
              _id: req.user._id,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
            },
          },
        },
      },
      { returnDocument: 'after' }
    )
      .select('issue.status issue.audit.note')
      .lean()
      .orFail();

    res.status(200).json(updatedIssue);
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get compliant rate, order accuracy, and issues
router.get('/issue/:start/:end', auth, async (req, res) => {
  if (
    !req.user ||
    (req.user.role !== 'ADMIN' &&
      (req.user.role !== 'CUSTOMER' || !req.user.isCompanyAdmin))
  ) {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { start, end } = req.params;

  // Get the next day date of the end date
  // to include the feedback from today in the query
  const dayAfterEndDate = new Date(end);
  dayAfterEndDate.setDate(dayAfterEndDate.getDate() + 1);

  try {
    const feedback = await Feedback.find({
      type: 'ISSUE',
      createdAt: { $gte: start, $lt: dayAfterEndDate },
    })
      .select('-rating')
      .lean();

    const orderCount = await Order.countDocuments({
      status: 'DELIVERED',
      createdAt: { $gte: start, $lt: dayAfterEndDate },
    });

    const validatedIssueCount = await Feedback.countDocuments({
      type: 'ISSUE',
      'issue.status': 'VALIDATED',
      createdAt: { $gte: start, $lt: dayAfterEndDate },
    });

    const validatedMissingAndIncorrectMealIssueCount =
      await Feedback.countDocuments({
        type: 'ISSUE',
        'issue.status': 'VALIDATED',
        'issue.category': { $in: ['Missing Meal', 'Incorrect Meal'] },
        createdAt: { $gte: start, $lt: dayAfterEndDate },
      });

    const complaintRate = (validatedIssueCount / orderCount) * 100;
    const orderAccuracy =
      (1 - validatedMissingAndIncorrectMealIssueCount / orderCount) * 100;

    res.status(200).json({
      feedback,
      stats: {
        complaintRate:
          isNaN(complaintRate) || !isFinite(complaintRate)
            ? 0
            : toUSNumber(complaintRate),
        orderAccuracy:
          isNaN(orderAccuracy) || !isFinite(orderAccuracy)
            ? 0
            : toUSNumber(orderAccuracy),
      },
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
