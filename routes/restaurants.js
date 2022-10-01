const express = require("express");
const Restaurant = require("../models/restaurant");
const authUser = require("../middleware/authUser");
const restaurant = require("../models/restaurant");

// Initialize router
const router = express.Router();

// Get all the restaurants
router.get("/", authUser, async (req, res) => {
  // Get the role from req
  const { role } = req.user;

  // If role is admin
  if (role === "admin") {
    // Fetch all the restaurants
    const restaurants = await Restaurant.find().select(
      "-__v -updatedAt -createdAt"
    );

    // Return the restaurants
    res.status(200).json(restaurants);
  } else {
    // Return not authorized if role isn't admin
    res.status(401);
    throw new Error("Not authorized");
  }
});

module.exports = router;
