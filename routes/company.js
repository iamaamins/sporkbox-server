const express = require("express");
const Company = require("../models/company");
const authUser = require("../middleware/authUser");

// Initialize router
const router = express.Router();

// Create a company
router.post("/register", authUser, async (req, res) => {
  const { role } = req.user;
  const { name, website, code, budget } = req.body;

  // If all the fields aren't provided
  if (!name || !website || !code || !budget) {
    res.status(400);
    throw new Error("Please provide all the fields");
  }

  if (role === "ADMIN") {
    // Create a new company
    const response = await Company.create({
      name,
      website,
      code,
      budget,
    });

    // If company is created successfully
    if (response) {
      res.status(201).json(response);
    } else {
      // If company isn't created successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Get all companies
router.get("/", authUser, async (req, res) => {
  const { role } = req.user;

  // If role is admin
  if (role === "ADMIN") {
    // Create a new company
    const companies = await Company.find()
      .select("-__v -updatedAt")
      .sort({ createdAt: -1 });

    // If company is created successfully
    if (companies) {
      // Send the companies with response
      res.status(201).json(companies);
    } else {
      // If company isn't created successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Delete a company

// Edit a company

module.exports = router;
