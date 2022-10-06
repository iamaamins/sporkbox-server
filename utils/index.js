const jwt = require("jsonwebtoken");

// Generate token and set cookie to header
function setCookie(res, user) {
  // Destructure user object
  const { id, role } = user;

  // Generate token
  const jwtToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  // Set cookie to header
  res.cookie(role.toLowerCase(), jwtToken, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    // sameSite: "strict",
    secure: process.env.NODE_ENV !== "development",
  });
}

module.exports = setCookie;
