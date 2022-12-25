import moment from "moment-timezone";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { Response } from "express";
import Restaurant from "../models/restaurant";
import { IOrder, ISortScheduledRestaurant } from "../types";
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

// Convert date to string
export const convertDateToText = (date: Date | string): string =>
  new Date(date).toUTCString().split(" ").slice(0, 3).join(" ");

// General mail
export const sendEmail = async (order: IOrder): Promise<string> => {
  // Create template
  const template = {
    to: order.customer.email,
    from: process.env.SENDER_EMAIL,
    subject: `Order Status Update`,
    html: `
    <p>Hi ${order.customer.firstName} ${order.customer.lastName}, your Sporkbox order of ${order.item.name} from ${order.restaurant.name} is delivered now! Please collect from the reception point.</p>
    `,
  };

  // Send the email
  try {
    await mail.send(template as MailDataRequired);
    return "Email is sent successfully";
  } catch (err) {
    // @ts-ignore
    console.log(err.response.body.errors);
    return "Email isn't sent successfully";
  }
};

// Convert date to slug
export const convertDateToMS = (date: Date | string): number =>
  new Date(date).getTime();

// Sort by date
export const sortByDate = (
  a: ISortScheduledRestaurant,
  b: ISortScheduledRestaurant
): number => convertDateToMS(a.date) - convertDateToMS(b.date);

// Get future date in UTC as the restaurant
// schedule date and delivery date has no timezone
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
const nextSaturdayUTCTimestamp = getFutureDate(6);
const nextWeekMondayUTCTimestamp = getFutureDate(8);
const nextWeekSaturdayUTCTimestamp = getFutureDate(13);
const followingWeekMondayUTCTimestamp = getFutureDate(15);
const followingWeekSaturdayUTCTimestamp = getFutureDate(20);

// Timestamp of current moment
const now = Date.now();

// Check if isDST
const isDST = moment.tz(new Date(), "America/Los_Angeles").isDST();

// Los Angeles time zone offset
const losAngelesTimeZoneOffsetInMS = isDST ? 420 : 480 * 60000;

// Timestamp of Los Angeles next Saturday
const nextSaturdayLosAngelesTimeStamp =
  nextSaturdayUTCTimestamp + losAngelesTimeZoneOffsetInMS;

// Filters
export const gte =
  now < nextSaturdayLosAngelesTimeStamp
    ? nextWeekMondayUTCTimestamp
    : followingWeekMondayUTCTimestamp;
export const lt =
  now < nextSaturdayLosAngelesTimeStamp
    ? nextWeekSaturdayUTCTimestamp
    : followingWeekSaturdayUTCTimestamp;

export async function getUpcomingWeekRestaurants(companyName: string) {
  // Get the scheduled restaurants
  const response = await Restaurant.find({
    schedules: {
      $elemMatch: {
        date: { $gte: gte },
        "company.name": companyName,
      },
    },
  }).select("-__v -updatedAt -createdAt -address");

  // Create upcoming week restaurants, then flat and sort
  const upcomingWeekRestaurants = response
    .map((upcomingWeekRestaurant) => ({
      ...upcomingWeekRestaurant.toObject(),
      schedules: upcomingWeekRestaurant.schedules.filter(
        (schedule) =>
          convertDateToMS(schedule.date) >= gte &&
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
  return upcomingWeekRestaurants;
}
