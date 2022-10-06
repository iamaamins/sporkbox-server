const jwt = require("jsonwebtoken");

// Generate token and set cookie to header
function setCookie(res, user) {
  // // Destructure user object
  // const { _id, role } = user;

  // console.log(id);

  // Generate token
  const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  // Set cookie to header
  res.cookie(user.role.toLowerCase(), jwtToken, {
    httpOnly: true,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    sameSite: "strict",
    // domain: process.env.SITE_URL,
    secure: process.env.NODE_ENV !== "development",
  });
}

module.exports = setCookie;
