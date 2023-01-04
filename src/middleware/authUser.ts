import User from "../models/user";
import { IUserCompany } from "../types";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export default async function handler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Return not authorized in there
  // is no cookie in the headers
  if (!req.cookies) {
    res.status(401);
    throw new Error("Not Authorized");
  }

  // If there are cookies
  const { token } = req.cookies;

  // Return not authorized in there is no token
  if (!token) {
    res.status(401);
    throw new Error("Not Authorized");
  }

  // Decode the token
  const decoded = jwt.verify(
    token,
    process.env.JWT_SECRET as string
  ) as JwtPayload;

  try {
    // Find the user
    const user = await User.findById(decoded.id)
      .select("-__v -password -updatedAt -createdAt")
      // .populate<{restaurant: IRestaurant}>(
      //   "restaurant",
      //   "-__v -updatedAt -createdAt"
      // )
      .populate<{ company: IUserCompany }>(
        "company",
        "-__v -updatedAt -createdAt -code -website"
      )
      .lean();

    // If there is a user in db
    if (user) {
      // Send User data to the next middleware
      req.user = user;

      // Call the next middleware
      next();
    }
  } catch (err) {
    // If user isn't found
    throw err;
  }
}
