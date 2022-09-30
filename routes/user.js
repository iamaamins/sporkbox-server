const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const { serialize } = require("cookie");
const generateToken = require("../utils");
const authUser = require("../middleware/authUser");

// Initialize router
const router = express.Router();

// user login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // If a value isn't provided
  if (!email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Find the user
  const user = await User.findOne({ email });

  // If user exists and password matches
  if (user && (await bcrypt.compare(password, user.password))) {
    // Generate token
    const jwtToken = generateToken(user.id);

    // Set response header cookie with jwt token
    res.setHeader(
      "Set-Cookie",
      serialize("token", jwtToken, {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 1 week
        sameSite: "strict",
        secure: process.env.NODE_ENV !== "development",
      })
    );

    // Send user data with the response
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } else {
    // If user doesn't exist or password doesn't match
    res.status(400);
    throw new Error("Invalid credentials");
  }
});

router.get("/me", authUser, (req, res) => {
  res.json(req.user);
});

module.exports = router;
