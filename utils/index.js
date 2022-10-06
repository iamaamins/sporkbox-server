const jwt = require("jsonwebtoken");

// Generate token and set cookie to header
function setCookie(res, user) {
  // // Destructure user object
  const { id, role } = user;

  // Generate token
  const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  // Set cookie to header
  res.cookie(user.role.toLowerCase(), jwtToken, {
    httpOnly: true,
    path: "/",
    secure: true,
    sameSite: "none",
    domain: process.env.SITE_URL,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
  });
}

module.exports = setCookie;
