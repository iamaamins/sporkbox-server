const bcrypt = require("bcrypt");
const express = require("express");
const User = require("../models/user");
const setCookie = require("../utils");

// Initialize router
const router = express.Router();

// Register a vendor and a restaurant
router.post("/register", async (req, res) => {
  // Get data from req body
  const { name, email, password, restaurantName, restaurantAddress } = req.body;

  // If a value isn't provided
  if (!name || !email || !password || !restaurantName || !restaurantAddress) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Check if vendor exists
  const vendorExists = await User.findOne({ email });

  // Throw error if vendor already exists
  if (vendorExists) {
    res.status(400);
    throw new Error("Vendor already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create a vendor
  const vendor = await User.create({
    name,
    email,
    role: "VENDOR",
    password: hashedPassword,
  });

  // If vendor is created successfully
  if (vendor) {
    // Generate jwt token and set
    // cookie to the response header
    setCookie(res, vendor);

    // Create restaurant with vendor id
    const response = await Restaurant.create({
      owner: vendor.id,
      name: restaurantName,
      address: restaurantAddress,
      status: "PENDING",
    });

    // If restaurant is created
    if (response) {
      // Fetch the restaurant with owner data
      const restaurant = await Restaurant.findById(response.id)
        .select("-__v -updatedAt")
        .populate("owner", "-__v -password -createdAt -updatedAt");

      // If restaurant is found
      if (restaurant) {
        // Send the data with response
        res.status(200).json(restaurant);
      } else {
        // If restaurant isn't found
        res.status(500);
        throw new Error("Something went wrong");
      }
    } else {
      // If the restaurant isn't created successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If vendor isn't created successfully
    res.status(500);
    throw new Error("Something went wrong");
  }
});
