const jwt = require("jsonwebtoken");

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

module.exports = { setCookie, deleteFields, convertDateToText };
