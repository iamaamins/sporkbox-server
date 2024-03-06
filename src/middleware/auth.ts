import User from '../models/user';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { unAuthorized } from '../lib/messages';

export default async function handler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.cookies) {
    console.log(unAuthorized);
    res.status(401);
    throw new Error(unAuthorized);
  }

  const { token } = req.cookies;
  if (!token) {
    console.log(unAuthorized);
    res.status(401);
    throw new Error(unAuthorized);
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    const user = await User.findById(decoded._id)
      .select('-__v -password -updatedAt -createdAt')
      .lean();

    if (!user) {
      console.log(unAuthorized);
      res.status(401);
      throw new Error(unAuthorized);
    }

    req.user = user;
    next();
  } catch (err) {
    console.log(err);
    throw err;
  }
}
