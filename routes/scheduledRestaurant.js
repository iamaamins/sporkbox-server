const express = require("express");
const authUser = require("../middleware/authUser");
const ScheduledRestaurant = require("../models/scheduledRestaurant");
const { deleteFields } = require("../utils");

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
    .populate("restaurant", "-__v -updatedAt")
    .sort({ scheduledOn: 1 })
    .select("-__v -createdAt -updatedAt");

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
    // If a restaurant is already
    // scheduled on the same date
    const isScheduled = await ScheduledRestaurant.findOne({
      scheduledOn: date,
    }).lean();

    // If there is a scheduled restaurant on the same date
    if (isScheduled) {
      res.status(401);
      throw new Error("Restaurant is already scheduled on the date");
    }

    // Schedule a restaurant
    const scheduledRestaurant = (
      await (
        await ScheduledRestaurant.create({
          restaurant: restaurantId,
          scheduledOn: date,
        })
      ).populate("restaurant", "-__v -updatedAt")
    ).toObject();

    // Delete fields
    deleteFields(scheduledRestaurant);

    // If schedule date is updates successfully
    if (scheduledRestaurant) {
      res.status(200).json(scheduledRestaurant);
    } else {
      // If schedule date isn't updated successfully
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
