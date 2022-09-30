const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const setCookie = require("../utils");

// Initialize router
const router = express.Router();

// Register vendor
router.post("/register", async (req, res) => {
  const { name, email, password, restaurantName, restaurantAddress } = req.body;

  // If a value isn't provided
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Check if user exists
  const vendorExists = await User.findOne({ email });

  // Throw error if vendor already exists
  if (vendorExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const vendor = await User.create({
    name,
    email,
    role: "vendor",
    password: hashedPassword,
  });

  if (vendor) {
    // Generate jwt token and set cookie
    // to the response header
    setCookie(vendor.id, res, "vendor");

    // Send the data with response
    res.json({
      id: vendor._id,
      name: vendor.name,
      email: vendor.email,
      role: vendor.role,
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

// Get user data
router.get("/me", async (req, res) => {
  res.json({ message: "Get user data" });
});

module.exports = router;
