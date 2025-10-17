import { Router } from 'express';
import auth from '../middleware/auth';
import Feedback from '../models/feedback';
import { ISSUE_CATEGORIES, FeedbackType, TYPES } from '../data/FEEDBACK';
import { unAuthorized } from '../lib/messages';
import Restaurant from '../models/restaurant';
import Order from '../models/order';
import { toUSNumber } from '../lib/utils';

const router = Router();

// Add a feedback
router.post('/:type', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { type } = req.params;
  const { data } = req.body;

  if (!type || !data) {
    console.error('Feedback type and data are required');
    res.status(400);
    throw new Error('Feedback type and data are required');
  }

  const feedbackType = type.toUpperCase() as FeedbackType;

  if (!TYPES.includes(feedbackType)) {
    console.error('Invalid feedback type');
    res.status(400);
    throw new Error('Invalid feedback type');
  }

  if (feedbackType === 'GENERAL' && !data.rating) {
    console.error('General feedback must provide a rating');
    res.status(400);
    throw new Error('General feedback must provide a rating');
  }

  if (
    feedbackType === 'ISSUE' &&
    (!data.category ||
      !data.date ||
      !data.restaurantId ||
      !data.message ||
      !ISSUE_CATEGORIES.includes(data.category))
  ) {
    console.error(
      'Issue feedback must provide a valid category, date, restaurant id and message'
    );
    res.status(400);
    throw new Error(
      'Issue feedback must provide a valid category, date, restaurant id and message'
    );
  }

  try {
    const customer = {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
    };

    if (feedbackType === 'GENERAL') {
      await Feedback.create({
        customer,
        type: feedbackType,
        rating: data.rating,
      });
    } else {
      const restaurant = await Restaurant.findOne({
        _id: data.restaurantId,
        status: 'ACTIVE',
      })
        .select('name')
        .lean()
        .orFail();

      await Feedback.create({
        customer,
        type: feedbackType,
        issue: {
          category: data.category,
          date: data.date,
          restaurant: { _id: restaurant._id, name: restaurant.name },
          message: data.message,
          isValidated: false,
        },
      });
    }

    res.status(200).json('Feedback submitted');
  } catch (err) {
    console.error(err);
    throw err;
  }
});

// Get compliant rate, order accuracy, and issues
router.get('/issue/:start/:end', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    console.error(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { start, end } = req.params;

  try {
    const issues = await Feedback.find({
      type: 'ISSUE',
      createdAt: { $gte: start, $lte: end },
    })
      .select('-rating')
      .lean();

    const orderCount = await Order.countDocuments({
      status: 'DELIVERED',
      createdAt: { $gte: start, $lte: end },
    });

    const validatedIssueCount = await Feedback.countDocuments({
      type: 'ISSUE',
      'issue.isValidated': true,
      createdAt: { $gte: start, $lte: end },
    });

    const validatedMissingAndIncorrectMealIssueCount =
      await Feedback.countDocuments({
        type: 'ISSUE',
        'issue.isValidated': true,
        'issue.category': { $in: ['Missing Meal', 'Incorrect Meal'] },
        createdAt: { $gte: start, $lte: end },
      });

    const complaintRate = (validatedIssueCount / orderCount) * 100;

    const orderAccuracy =
      (1 - validatedMissingAndIncorrectMealIssueCount / orderCount) * 100;

    res.status(200).json({
      issues,
      complaintRate:
        isNaN(complaintRate) || !isFinite(complaintRate)
          ? 0
          : toUSNumber(complaintRate),
      orderAccuracy:
        isNaN(orderAccuracy) || !isFinite(orderAccuracy)
          ? 0
          : toUSNumber(orderAccuracy),
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
