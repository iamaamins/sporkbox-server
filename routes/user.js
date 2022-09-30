const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const { serialize } = require("cookie");
const generateToken = require("../utils");
const authUser = require("../middleware/authUser");
const setCookie = require("../utils");

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
    // Generate jwt token and set cookie
    // to the response header
    setCookie(user.id, res, user.role);

    // Send user data with the response
    res.json({
      id: user._id,
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
