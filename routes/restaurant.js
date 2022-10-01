const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const setCookie = require("../utils");
const Restaurant = require("../models/restaurant");
const authUser = require("../middleware/authUser");

// Initialize router
const router = express.Router();

router.post("/register", async (req, res) => {
  const { name, email, password, restaurantName, restaurantAddress } = req.body;

  // If a value isn't provided
  if (!name || !email || !password || !restaurantName || !restaurantAddress) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Check if user exists
  const vendorExists = await User.findOne({ email });

  // Throw error if vendor already exists
  if (vendorExists) {
    res.status(400);
    throw new Error("Vendor already exists");
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

    // Create restaurant with vendor data
    const response = await Restaurant.create({
      owner: {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
      },
      name: restaurantName,
      address: restaurantAddress,
      status: "Pending",
    });

    // If restaurant is created
    if (response) {
      // Create restaurant
      const restaurant = {
        owner: response.owner,
        name: response.name,
        address: response.address,
        status: response.status,
        _id: response.id,
      };

      // Send the data with response
      res.json(restaurant);
    } else {
      res.status(400);
      throw new Error("Invalid restaurant data");
    }
  } else {
    res.status(400);
    throw new Error("Invalid vendor data");
  }
});

// Get all the restaurants
router.get("/", authUser, async (req, res) => {
  // Get the role from req
  const { role } = req.user;

  // If role is admin
  if (role === "admin") {
    // Fetch all the restaurants
    const restaurants = await Restaurant.find().select("-__v -updatedAt");

    // Return the restaurants
    res.status(200).json(restaurants);
  } else {
    // Return not authorized if role isn't admin
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Get a single restaurants
router.get("/:id", authUser, async (req, res) => {
  // Get the role from req
  const { role } = req.user;

  // If role is admin
  if (role === "admin") {
    // Fetch all the restaurants
    const restaurant = await Restaurant.findById(req.params.id).select(
      "-__v -updatedAt"
    );

    // Return the restaurants
    res.status(200).json(restaurant);
  } else {
    // Return not authorized if role isn't admin
    res.status(401);
    throw new Error("Not authorized");
  }
});

module.exports = router;
