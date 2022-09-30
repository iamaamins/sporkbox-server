const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { parse } = require("cookie");

async function handler(req, res, next) {
  // Return not authorized in there
  // is no cookie in the headers
  if (!req.headers.cookie) {
    res.status(401);
    throw new Error("Not Authorized");
  }

  // If there is no token in the cookie
  const cookie = parse(req.headers.cookie);

  // Get the token from cookie
  const token = cookie.admin || cookie.vendor || cookie.customer;

  // Return not authorized in there is no token
  if (!token) {
    res.status(401);
    throw new Error("Not Authorized");
  }

  // If there is a token in the cookie
  try {
    // Decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get the User data from DB
    const response = await User.findById(decoded.id).select(
      "-password -__v -updatedAt -createdAt"
    );

    // Create new User
    const user = {
      id: response?._id,
      name: response?.name,
      email: response?.email,
      role: response?.role,
    };

    // Send User data to the next middleware
    req.user = user;

    // Call the next middleware
    next();
  } catch (err) {
    // If the token is invalid or failed to
    // get User data from DB
    console.log(err);
    res.status(401);
    throw new Error("Not authorized");
  }
}

module.exports = handler;
