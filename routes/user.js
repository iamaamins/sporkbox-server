const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const setCookie = require("../utils");
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
    // Generate jwt token and set
    // cookie to the response header
    setCookie(res, user);

    // // Generate token
    // const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    //   expiresIn: "7d",
    // });

    // res.cookie(user.role.toLowerCase(), jwtToken, { httpOnly: true });

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

// Log out user
router.post("/logout", authUser, async (req, res) => {
  const { role } = req.user;

  // Clear cookie
  res.clearCookie(role.toLowerCase());

  // Return the response
  res.status(200).json({ message: "Successfully logout" });
});

// Get user details
router.get("/me", authUser, (req, res) => {
  res.status(200).json(req.user);
});

module.exports = router;
