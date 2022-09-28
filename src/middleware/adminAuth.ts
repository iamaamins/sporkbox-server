import Admin from "../models/admin";
import jwt, { JwtPayload } from "jsonwebtoken";
import { parse } from "cookie";
import { Request, Response, NextFunction } from "express";

export default async function handler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.headers.cookie) {
    res.status(403);
    throw new Error("Not Authorized");
  }

  console.log(parse(req.headers.cookie));

  // Check if there is a header and it starts with Bearer
  // if (req.headers.cookie) {
  //   try {
  //     // Decode the token
  //     const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

  //     // Send admin data to the route
  //     req.admin = await Admin.findById(decoded.id).select(
  //       "-password -__v -updatedAt -createdAt"
  //     );

  //     // Execute the route middleware
  //     next();
  //   } catch (err) {
  //     // If the token is invalid or failed to
  //     // get admin data from DB
  //     console.log(err);
  //     res.status(401);
  //     throw new Error("Not authorized");
  //   }
  // }

  // If no token is provided
  // if (!token) {
  //   res.status(401);
  //   throw new Error("Not authorized");
  // }
}
