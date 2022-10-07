const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const setCookie = require("../utils");
const authUser = require("../middleware/authUser");
const jwt = require("jsonwebtoken");

// Initialize router
const router = express.Router();

// Log out user
router.post("/logout", async (req, res) => {
  // Clear cookie
  res.clearCookie("token").end();
});

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
    // Generate jwt token and set
    // cookie to the response header
    setCookie(res, user);

    // Send user data with the response
    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } else {
    // If user doesn't exist or password doesn't match
    res.status(401);
    throw new Error("Invalid credentials");
  }
});

// Get user details
router.get("/me", authUser, (req, res) => {
  res.status(200).json(req.user);
});

module.exports = router;
