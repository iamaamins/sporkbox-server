const express = require("express");
const { deleteFields } = require("../utils");
const authUser = require("../middleware/authUser");
const Restaurant = require("../models/restaurant");
const ScheduledRestaurant = require("../models/scheduledRestaurant");

// Initialize router
const router = express.Router();

// Get all the scheduled restaurants
router.get("/", async (req, res) => {
  // Get future date
  function getFutureDate(dayToAdd) {
    // Today
    const today = new Date();

    // Day number of current week sunday
    const sunday = today.getDate() - today.getDay();

    // Return a future date
    return new Date(today.setDate(sunday + dayToAdd));
  }

  // Get dates
  const today = new Date();
  const nextSaturday = getFutureDate(6);
  const nextSunday = getFutureDate(7);
  const nextWeekFriday = getFutureDate(12);
  const followingSunday = getFutureDate(14);
  const followingFriday = getFutureDate(19);

  // Get the scheduled restaurants
  const scheduledRestaurants = await ScheduledRestaurant.find({
    scheduledOn: {
      $gte: new Date(today < nextSaturday ? nextSunday : followingSunday),
      $lt: new Date(today < nextSaturday ? nextWeekFriday : followingFriday),
    },
  })
    .sort({ scheduledOn: 1 })
    .select("-__v -createdAt -updatedAt");

  // Remove past scheduled restaurants
  await ScheduledRestaurant.deleteMany({
    scheduledOn: {
      $lt: Date.now(),
    },
  });

  // If scheduled restaurants are fetched successfully
  if (scheduledRestaurants) {
    // Return the scheduled restaurants with response
    res.status(200).json(scheduledRestaurants);
  } else {
    res.status(500);
    throw new Error("Something went wrong");
  }
});

// Schedule a restaurant
router.post("/schedule/:restaurantId", authUser, async (req, res) => {
  const { role } = req.user;
  const { date } = req.body;
  const { restaurantId } = req.params;

  // If date isn't provided
  if (!date) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // If role is admin
  if (role === "ADMIN") {
    // Check if the restaurant is already scheduled on the same day
    const isScheduled = await ScheduledRestaurant.findOne({ restaurantId })
      .where("scheduledOn")
      .equals(date);

    // If the restaurant is already scheduled
    if (isScheduled) {
      res.status(401);
      throw new Error("Restaurant is already scheduled on the date");
    }

    // Find the restaurant
    const restaurant = await Restaurant.findById(restaurantId).lean();

    // If restaurant is found successfully
    if (restaurant) {
      // // Schedule a restaurant
      const scheduledRestaurant = (
        await ScheduledRestaurant.create({
          scheduledOn: date,
          name: restaurant.name,
          items: restaurant.items,
          restaurantId: restaurant._id,
        })
      ).toObject();

      // Delete fields
      deleteFields(scheduledRestaurant);

      // If restaurant is scheduled successfully
      if (scheduledRestaurant) {
        // Send the restaurant with response
        res.status(200).json(scheduledRestaurant);
      } else {
        // If schedule date isn't updated successfully
        res.status(500);
        throw new Error("Something went wrong");
      }
    } else {
      // If restaurant isn't found successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If role isn't admin
    res.status(401);
    throw new Error("Not authorized");
  }
});

module.exports = router;
