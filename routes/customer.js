const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Customer = require("../models/customer");

// Initialize router
const router = express.Router();

// Register customer
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  // If a value isn't provided
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Check if user exists
  const userExists = await Customer.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error("Customer already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const customer = await Customer.create({
    name,
    email,
    password: hashedPassword,
  });

  if (customer) {
    res.status(201).json({
      id: customer.id,
      name: customer.name,
      email: customer.email,
    });
  } else {
    res.status(400);
    throw new Error("Invalid customer data");
  }
});

// Login customer
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // If a value isn't provided
  if (!email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Find the user
  const customer = await Customer.findOne({ email });

  // If customer exists and password matches
  if (customer && (await bcrypt.compare(password, customer.password))) {
    res.json({
      id: customer.id,
      name: customer.name,
      email: customer.email,
    });
  } else {
    // If customer doesn't exist or password doesn't match
    res.status(400);
    throw new Error("Invalid credentials");
  }
});

// Get customer data
router.get("/me", async (req, res) => {
  res.json({ message: "Get customer data" });
});

module.exports = router;
