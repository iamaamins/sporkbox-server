import { Router } from 'express';
import User from '../models/user';
import limiter from '../config/limiter';

const router = Router();

router.get('/', limiter, async (req, res) => {
  try {
    await User.countDocuments();
    res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export default router;
