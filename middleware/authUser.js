const User = require("../models/user");
const jwt = require("jsonwebtoken");

async function handler(req, res, next) {
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
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Get the User data from DB
  const user = await User.findById(decoded.id)
    .select("-__v -password -updatedAt -createdAt")
    .populate("company" || "restaurant", "-__v -updatedAt -createdAt");

  // If there is a user in db
  if (user) {
    // Send User data to the next middleware
    req.user = user;

    // Call the next middleware
    next();
  } else {
    // If the token is invalid or
    // failed to get User data from DB
    res.status(401);
    throw new Error("Not authorized");
  }
}

module.exports = handler;
