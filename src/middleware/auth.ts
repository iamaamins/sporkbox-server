import User from '../models/user';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { unAuthorized } from '../lib/messages';

export default async function handler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.cookies || !req.cookies.token) {
    console.error(unAuthorized);
    res.status(401);
    throw new Error(unAuthorized);
  }

  try {
    const decoded = jwt.verify(
      req.cookies.token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    const user = await User.findById(decoded._id)
      .select('-__v -password -updatedAt')
      .lean();

    if (!user) {
      console.error(unAuthorized);
      res.status(401);
      throw new Error(unAuthorized);
    }

    if (user.status !== 'ACTIVE') {
      console.error(unAuthorized);
      res.status(403);
      throw new Error(unAuthorized);
    }

    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    throw err;
  }
}
