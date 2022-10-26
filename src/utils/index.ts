import { Response } from "express";
import { Types } from "mongoose";

const jwt = require("jsonwebtoken");
const mail = require("@sendgrid/mail");

// Set the sendgrid api key
mail.setApiKey(process.env.SENDGRID_API_KEY);

// Generate token and set cookie to header
export const setCookie = (res: Response, id: Types.ObjectId) => {
  // Generate token
  const jwtToken = jwt.sign({ id }, process.env.JWT_SECRET, {
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
export const deleteFields = (data: object, moreFields?: string[]) => {
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
export const convertDateToText = (date: string) =>
  new Date(date).toDateString().split(" ").slice(0, 3).join(" ");

// General mail
export const sendEmail = async (name: string, email: string) => {
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
    await mail.send(template);
    return "Email successfully sent";
  } catch (err) {
    return "Server error";
  }
};

// Convert date to slug
export const convertDateToMS = (date: string) => new Date(date).getTime();

// Sort by date
export const sortByDate = (a: any, b: any) =>
  convertDateToMS(a.scheduledOn) - convertDateToMS(b.scheduledOn);

// Get future date
export const getFutureDate = (dayToAdd: number) => {
  // Today
  const today = new Date();

  // Day number of current week sunday
  const sunday = today.getDate() - today.getDay();

  // Return a future date
  return convertDateToMS(
    new Date(today.setDate(sunday + dayToAdd)).toDateString()
  );
};

// Get dates in iso string
const nextSaturday = getFutureDate(6);
const nextMonday = getFutureDate(8);
const nextWeekSaturday = getFutureDate(13);
const followingMonday = getFutureDate(15);
const followingSaturday = getFutureDate(20);
const today = convertDateToMS(new Date().toDateString());

// Filters
export const gte = today < nextSaturday ? nextMonday : followingMonday;
export const lt = today < nextSaturday ? nextWeekSaturday : followingSaturday;
