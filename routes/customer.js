const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const setCookie = require("../utils");
const Company = require("../models/company");

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

  // Get company code from customer's email
  const companyCode = email.split("@")[1].split(".")[0];

  // Check if company exists
  const company = await Company.findOne({ code: companyCode });

  // If company doesn't exist
  if (!company) {
    res.status(400);
    throw new Error("Your company isn't registered");
  }

  // Check if customer exists
  const customerExists = await User.findOne({ email });

  // If customer exists
  if (customerExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create customer
  const response = await User.create({
    name,
    email,
    role: "CUSTOMER",
    company: company.id,
    password: hashedPassword,
  });

  // If customer is created successfully
  if (response) {
    // Find the customer and populate the company
    const customer = await User.findById(response.id)
      .select("-__v -password -createdAt -updatedAt")
      .populate("company", "-__v -createdAt -updatedAt");

    if (customer) {
      // Generate jwt token and set
      // cookie to the response header
      setCookie(res, customer);

      // Send the data with response
      res.status(201).json(customer);
    } else {
      // If customer isn't found successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If customer isn't created successfully
    res.status(500);
    throw new Error("Something went wrong");
  }
});

module.exports = router;
