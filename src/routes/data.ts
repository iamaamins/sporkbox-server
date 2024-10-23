import { Router } from 'express';
import auth from '../middleware/auth';
import { unAuthorized } from '../lib/messages';
import { DIETARY_TAGS } from '../data/DIETARY_TAGS';

const router = Router();

// Get dietary tags
router.get('/dietary-tags', auth, async (req, res) => {
  if (!req.user) {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  return res.status(200).json(DIETARY_TAGS);
});

export default router;
