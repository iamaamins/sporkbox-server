const express = require("express");
const Company = require("../models/company");
const authUser = require("../middleware/authUser");

// Initialize router
const router = express.Router();

// Add a company
router.post("/add", authUser, async (req, res) => {
  const { role } = req.user;
  const { name, website, address, code, budget } = req.body;

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
      address,
      code,
      budget,
    });

    // If company is created successfully
    if (response) {
      // Create company
      const company = {
        _id: response.id,
        name: response.name,
        website: response.website,
        address: response.address,
        code: response.code,
        budget: response.budget,
        createdAt: response.createdAt,
      };

      // Send the company with response
      res.status(201).json(company);
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
router.delete("/:companyId", authUser, async (req, res) => {
  const { role } = req.user;
  const { companyId } = req.params;

  // If role is admin
  if (role === "ADMIN") {
    // Find and delete the company
    const deleted = await Company.findByIdAndDelete(companyId);

    // If successfully deleted
    if (deleted) {
      res.status(200).json({ message: "Successfully deleted" });
    } else {
      // If not deleted successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If role isn't admin
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Edit a company

module.exports = router;
