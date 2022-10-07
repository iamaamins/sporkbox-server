const jwt = require("jsonwebtoken");

// Generate token and set cookie to header
function setCookie(res, user) {
  // // Destructure user object
  const { id, role } = user;

  // Generate token
  const jwtToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  // Set cookie to header
  res.cookie("token", jwtToken, {
    httpOnly: true,
    path: "/",
    domain: "https://sporkbytes.vercel.app/",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    secure: process.env.NODE_ENV !== "development",
  });
}

module.exports = setCookie;
