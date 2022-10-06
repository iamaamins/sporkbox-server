const jwt = require("jsonwebtoken");
const { serialize } = require("cookie");

function setCookie(id, res, token) {
  // Generate jwt token
  const jwtToken = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  // Set response header cookie with jwt token
  res.setHeader(
    "Set-Cookie",
    serialize(token, jwtToken, {
      domain: "https://sporkbytes.vercel.app",
      httpOnly: true,
      // path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      // sameSite: "none",
      secure: process.env.NODE_ENV !== "development",
    })
  );
}

module.exports = setCookie;
