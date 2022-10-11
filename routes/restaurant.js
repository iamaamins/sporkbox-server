const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const Restaurant = require("../models/restaurant");
const authUser = require("../middleware/authUser");

// Initialize router
const router = express.Router();

// Get all the scheduled restaurants
router.get("/scheduled", async (req, res) => {
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
  const restaurants = await Restaurant.find({
    scheduledOn: {
      $gte: new Date(today < nextSaturday ? nextSunday : followingSunday),
      $lt: new Date(today < nextSaturday ? nextWeekFriday : followingFriday),
    },
  })
    .sort({ scheduledOn: 1 })
    .select("-__v -updatedAt");

  // If restaurants are fetched successfully
  if (restaurants) {
    // Return the restaurants with response
    res.status(200).json(restaurants);
  } else {
    res.status(500);
    throw new Error("Something went wrong");
  }
});

// Add an item to a restaurant
router.post("/:restaurantId/add-item", authUser, async (req, res) => {
  const { role } = req.user;
  const { restaurantId } = req.params;
  const { name, description, tags, price } = req.body;

  // If restaurant id, name, description, tags, price aren't provided
  if (!name || !description || !tags || !price) {
    res.status(400);
    throw new Error("Please provide all the fields");
  }

  // If the role is either admin or vendor
  if (role === "ADMIN" || role === "VENDOR") {
    // Find the restaurant and add the item
    const updatedRestaurant = await Restaurant.findOneAndUpdate(
      { _id: restaurantId },
      {
        $push: { items: { name, description, tags, price } },
      },
      {
        returnDocument: "after",
      }
    ).select("-__v -updatedAt");

    // If item is successfully added to db
    if (updatedRestaurant) {
      // Return the updated restaurant
      res.status(201).json(updatedRestaurant);
    } else {
      // If item isn't successfully add to db
      res.status(500);
      throw new Error("Something went wrong!");
    }
  } else {
    // Return not authorized if role isn't admin or vendor
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Schedule a restaurant
router.put("/:restaurantId/schedule", authUser, async (req, res) => {
  const { role } = req.user;
  const { date } = req.body;
  const { restaurantId } = req.params;

  // If date isn't provided
  if (!date) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // Convert date to ISO string
  const ISOString = new Date(date).toISOString();

  // If role is admin
  if (role === "ADMIN") {
    // Get the updated restaurant
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      {
        scheduledOn: ISOString,
      },
      {
        returnDocument: "after",
      }
    ).select("-__v -updatedAt");

    // If schedule date is updates successfully
    if (updatedRestaurant) {
      res.status(200).json(updatedRestaurant);
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

// Edit an item
router.put("/:restaurantId/itemId/edit-item", authUser, (req, res) => {
  res.json("Hello");
});

// Delete an item
router.delete(
  "/:restaurantId/:itemId/delete-item",
  authUser,
  async (req, res) => {
    const { role } = req.user;
    const { restaurantId, itemId } = req.params;

    // If role is admin or vendor
    if (role === "ADMIN" || role === "VENDOR") {
      // Find the restaurant and remove the item
      const updatedRestaurant = await Restaurant.findByIdAndUpdate(
        { _id: restaurantId },
        {
          $pull: {
            items: { _id: itemId },
          },
        },
        {
          returnDocument: "after",
        }
      );

      // If the item is removed successfully
      if (updatedRestaurant) {
        // Send the updated restaurant with response
        res.status(200).json(updatedRestaurant);
      } else {
        // If the item isn't removed successfully
        res.status(500);
        throw new Error("Something went wrong");
      }
    } else {
      // If role isn't admin or vendor
      res.status(401);
      throw new Error("Not authorized");
    }
  }
);

module.exports = router;
