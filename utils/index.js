const jwt = require("jsonwebtoken");
const mail = require("@sendgrid/mail");

// Set the sendgrid api key
mail.setApiKey(process.env.SENDGRID_API_KEY);

// Generate token and set cookie to header
function setCookie(res, user) {
  // Generate token
  const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
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
}

// Delete unnecessary fields
function deleteFields(data, moreFields) {
  // Default fields
  let fields = ["__v", "updatedAt"];

  // If more fields are provided
  if (moreFields) {
    fields = [...fields, ...moreFields];
  }

  // Delete the fields
  fields.forEach((field) => delete data[field]);
}

// Convert iso date to locale date string
const convertDateToText = (date) =>
  new Date(date).toDateString().split(" ").slice(0, 3).join(" ");

// General mail
const sendEmail = async (name, email) => {
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
const convertDateToMS = (date) => new Date(date).getTime();

// Sort by date
const sortByDate = (a, b) =>
  convertDateToMS(a.scheduledOn) - convertDateToMS(b.scheduledOn);

// Get future date
function getFutureDate(dayToAdd) {
  // Today
  const today = new Date();

  // Day number of current week sunday
  const sunday = today.getDate() - today.getDay();

  // Return a future date
  return convertDateToMS(
    new Date(today.setDate(sunday + dayToAdd)).toDateString()
  );
}

// Get dates in iso string
const nextSaturday = getFutureDate(6);
const nextSunday = getFutureDate(7);
const nextWeekFriday = getFutureDate(12);
const followingSunday = getFutureDate(14);
const followingFriday = getFutureDate(19);
const today = convertDateToMS(new Date().toDateString());

// Filters
const gte = today < nextSaturday ? nextSunday : followingSunday;
const lt = today < nextSaturday ? nextWeekFriday : followingFriday;

module.exports = {
  lt,
  gte,
  setCookie,
  sendEmail,
  sortByDate,
  deleteFields,
  getFutureDate,
  convertDateToText,
  convertDateToMS,
};
