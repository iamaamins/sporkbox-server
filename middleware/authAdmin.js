const Admin = require("../models/admin");
const jwt = require("jsonwebtoken");
const { parse } = require("cookie");

async function handler(req, res, next) {
  // If no cookie in the headers
  if (!req.headers.cookie) {
    res.status(401);
    throw new Error("Not Authorized");
  }

  // If there is no token in the cookie
  const cookie = parse(req.headers.cookie);

  if (!cookie.token) {
    res.status(401);
    throw new Error("Not Authorized");
  }

  // If there is a token in the cookie
  try {
    // Decode the token
    const decoded = jwt.verify(cookie.token, process.env.JWT_SECRET);

    // Get the admin data from DB
    const response = await Admin.findById(decoded.id).select(
      "-password -__v -updatedAt -createdAt"
    );

    // Create new admin
    const admin = {
      id: response?._id,
      name: response?.name,
      email: response?.email,
      role: response?.role,
    };

    // Send admin data to the next middleware
    req.admin = admin;

    // Call the next middleware
    next();
  } catch (err) {
    // If the token is invalid or failed to
    // get admin data from DB
    console.log(err);
    res.status(401);
    throw new Error("Not authorized");
  }
}

module.exports = handler;
