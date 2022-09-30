const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const setCookie = require("../utils");

// Initialize router
const router = express.Router();

// Register user
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  // If a value isn't provided
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Check if user exists
  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const customer = await User.create({
    name,
    email,
    password: hashedPassword,
    role: "customer",
  });

  if (customer) {
    // Generate jwt token and set cookie
    // to the response header
    setCookie(customer.id, res);

    // Send the data with response
    res.json({
      id: customer._id,
      name: customer.name,
      email: customer.email,
      role: customer.role,
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

// Login user
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // If a value isn't provided
  if (!email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Find the user
  const user = await user.findOne({ email });

  // If user exists and password matches
  if (user && (await bcrypt.compare(password, user.password))) {
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  } else {
    // If user doesn't exist or password doesn't match
    res.status(400);
    throw new Error("Invalid credentials");
  }
});

// Get user data
router.get("/me", async (req, res) => {
  res.json({ message: "Get user data" });
});

module.exports = router;
