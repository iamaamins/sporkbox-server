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
  const customerExists = await User.findOne({ email });

  // If user exists
  if (customerExists) {
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
    role: "CUSTOMER",
    password: hashedPassword,
  });

  // If customer is created successfully
  if (customer) {
    // Generate jwt token and set cookie
    // to the response header
    setCookie(customer.id, res, "customer");

    // Send the data with response
    res.status(201).json({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      role: customer.role,
    });
  } else {
    // If customer isn't created successfully
    res.status(500);
    throw new Error("Something went wrong");
  }
});

// Get user data
router.get("/me", async (req, res) => {
  res.json({ message: "Get user data" });
});

module.exports = router;
