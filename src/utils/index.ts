import sharp from "sharp";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { Response } from "express";
import Restaurant from "../models/restaurant";
import { ISortScheduledRestaurant } from "../types";

// Generate token and set cookie to header
export const setCookie = (res: Response, _id: Types.ObjectId): void => {
  // Generate token
  const jwtToken = jwt.sign({ _id }, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });

  // Set cookie to header
  res.cookie("token", jwtToken, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    secure: process.env.NODE_ENV !== "development",
  });
};

// Delete unnecessary fields
export const deleteFields = (data: object, moreFields?: string[]): void => {
  // Default fields
  let fields = ["__v", "updatedAt"];

  // If more fields are provided
  if (moreFields) {
    fields = [...fields, ...moreFields];
  }

  // Delete the fields
  fields.forEach((field) => delete data[field as keyof object]);
};

// Convert number
export const formatNumberToUS = (number: number) =>
  +number.toLocaleString("en-US");

// Convert date to slug
export const convertDateToMS = (date: Date | string): number =>
  new Date(date).getTime();

// Sort by date
export const sortByDate = (
  a: ISortScheduledRestaurant,
  b: ISortScheduledRestaurant
): number => convertDateToMS(a.date) - convertDateToMS(b.date);

// Timestamp of current moment
export const now = Date.now();

// Get upcoming restaurant
export async function getUpcomingRestaurants(companyName: string) {
  try {
    // Get the scheduled restaurants
    const response = await Restaurant.find({
      schedules: {
        $elemMatch: {
          date: { $gte: now },
          status: "ACTIVE",
          "company.name": companyName,
        },
      },
    }).select("-__v -updatedAt -createdAt -address");

    // Create upcoming week restaurants, then flat and sort
    const upcomingRestaurants = response
      .map((upcomingWeekRestaurant) => ({
        ...upcomingWeekRestaurant.toObject(),
        schedules: upcomingWeekRestaurant.schedules.filter(
          (schedule) =>
            schedule.status === "ACTIVE" &&
            convertDateToMS(schedule.date) >= now &&
            schedule.company.name === companyName
        ),
      }))
      .map((upcomingWeekRestaurant) =>
        upcomingWeekRestaurant.schedules.map((schedule) => {
          // Destructure scheduled restaurant
          const { schedules, ...rest } = upcomingWeekRestaurant;

          // Create new restaurant object
          return {
            ...rest,
            date: schedule.date,
          };
        })
      )
      .flat(2)
      .sort(sortByDate);

    // Return the scheduled restaurants with response
    return upcomingRestaurants;
  } catch (err) {
    // If scheduled restaurants aren't fetched successfully
    throw err;
  }
}

// Check actions function
export function checkActions(
  actions = ["Archive", "Activate"],
  action: string,
  res: Response
) {
  if (!actions.includes(action)) {
    res.status(400);
    throw new Error("Please provide correct action");
  }
}

// Resize image
export async function resizeImage(
  res: Response,
  buffer: Buffer,
  width: number,
  height: number
) {
  try {
    // Return the resized buffer
    return await sharp(buffer)
      .resize({ width, height, fit: "cover" })
      .toBuffer();
  } catch (err) {
    // If image resize fails
    res.status(500);
    throw new Error("Failed to resize image");
  }
}

// Convert date to string
export const convertDateToText = (date: Date | string | number): string =>
  new Date(date).toUTCString().split(" ").slice(0, 3).join(" ");

// Generate unique string
export const generateRandomString = () =>
  crypto.randomBytes(16).toString("hex");
