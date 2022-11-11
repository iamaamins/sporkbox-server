import { IRestaurantSchema } from "./../types/index.d";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { Response } from "express";
import Restaurant from "../models/restaurant";
import { ISortScheduledRestaurant } from "../types";
import mail, { MailDataRequired } from "@sendgrid/mail";

// Set the sendgrid api key
mail.setApiKey(process.env.SENDGRID_API_KEY as string);

// Generate token and set cookie to header
export const setCookie = (res: Response, id: Types.ObjectId): void => {
  // Generate token
  const jwtToken = jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });

  // Set cookie to header
  res.cookie("token", jwtToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
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

// Convert iso date to locale date string
export const convertDateToText = (date: Date | string): string =>
  new Date(date).toUTCString().split(" ").slice(0, 3).join(" ");

// General mail
export const sendEmail = async (
  name: string,
  email: string
): Promise<string> => {
  // Create template
  const template = {
    to: email,
    from: process.env.SENDER_EMAIL,
    subject: `Order Status Update`,
    html: `
    <p>Hi ${name}, your sporkbytes order is delivered now! Please collect from the reception point.</p>
    `,
  };

  // Send the email
  try {
    await mail.send(template as MailDataRequired);
    return "Email successfully sent";
  } catch (err) {
    return "Server error";
  }
};

// Convert date to slug
export const convertDateToMS = (date: Date | string): number =>
  new Date(date).getTime();

// Sort by date
export const sortByDate = (
  a: ISortScheduledRestaurant,
  b: ISortScheduledRestaurant
): number => convertDateToMS(a.scheduledOn) - convertDateToMS(b.scheduledOn);

// Get future date
export function getFutureDate(dayToAdd: number) {
  // Today
  const today = new Date();

  // Sunday's date of current week
  const sunday = today.getUTCDate() - today.getUTCDay();

  // Get future date in MS
  const futureDate = today.setUTCDate(sunday + dayToAdd);

  // Get future date without hours in MS
  return new Date(futureDate).setUTCHours(0, 0, 0, 0);
}

// Get dates in iso string
// const today = new Date().getTime();
const nextSaturday = getFutureDate(6);
const nextMonday = getFutureDate(8);
const nextWeekSaturday = getFutureDate(13);
const followingMonday = getFutureDate(15);
const followingSaturday = getFutureDate(20);
const today = new Date().setUTCHours(0, 0, 0, 0);

// Filters
export const gte = today < nextSaturday ? nextMonday : followingMonday;
export const lt = today < nextSaturday ? nextWeekSaturday : followingSaturday;

export async function getUpcomingWeekRestaurants() {
  // Get the scheduled restaurants
  const response = await Restaurant.find({
    schedules: {
      $gte: gte,
      $lt: lt,
    },
  }).select("-__v -updatedAt -createdAt -address");

  // Create scheduled restaurants, then flat and sort
  const upcomingWeekRestaurants = response
    .map((upcomingWeekRestaurant) => ({
      ...upcomingWeekRestaurant.toObject(),
      schedules: upcomingWeekRestaurant.schedules.filter(
        (schedule) =>
          convertDateToMS(schedule) >= gte && convertDateToMS(schedule) < lt
      ),
    }))
    .map((upcomingWeekRestaurant) =>
      upcomingWeekRestaurant.schedules.map((schedule) => {
        // Destructure scheduled restaurant
        const { schedules, ...rest } = upcomingWeekRestaurant;

        // Create new restaurant object
        return {
          ...rest,
          scheduledOn: schedule,
        };
      })
    )
    .flat(2)
    .sort(sortByDate);

  // Return the scheduled restaurants with response
  return upcomingWeekRestaurants;
}

// Allowed cors origin
export const allowedOrigins = [
  "http://localhost:3000",
  "https://sporkbytes.vercel.app",
];
