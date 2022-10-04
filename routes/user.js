const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const setCookie = require("../utils");
const { serialize } = require("cookie");
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
    // Convert user role to lower case
    const role = user.role.toLowerCase();

    // Generate jwt token and set cookie
    // to the response header
    setCookie(user.id, res, role);

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
  const token = role.toLowerCase();

  // Remove the cookie
  res.setHeader(
    "Set-Cookie",
    serialize(token, "", {
      httpOnly: true,
      path: "/",
      expires: new Date(0),
      sameSite: "strict",
      secure: process.env.NODE_ENV !== "development",
    })
  );

  // Return the response
  res.status(200).json({ message: "Successfully logout" });
});

router.get("/me", authUser, (req, res) => {
  res.json(req.user);
});

module.exports = router;
