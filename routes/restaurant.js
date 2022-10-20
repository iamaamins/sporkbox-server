const express = require("express");
const Restaurant = require("../models/restaurant");
const authUser = require("../middleware/authUser");
const { deleteFields, convertDateToMilliseconds } = require("../utils");

// Initialize router
const router = express.Router();

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

  // Filters
  const gte = new Date(today < nextSaturday ? nextSunday : followingSunday);
  const lt = new Date(today < nextSaturday ? nextWeekFriday : followingFriday);

  // Get the scheduled restaurants
  const response = await Restaurant.find({
    schedules: {
      $gte: gte,
      $lt: lt,
    },
  }).select("-__v -updatedAt -createdAt -address");

  // If restaurants are found successfully
  if (response) {
    // Create scheduled restaurants, then flat and sort
    const scheduledRestaurants = response
      .map((scheduledRestaurant) => ({
        ...scheduledRestaurant.toObject(),
        schedules: scheduledRestaurant.schedules.filter(
          (schedule) => schedule >= gte && schedule < lt
        ),
      }))
      .map((scheduledRestaurant) =>
        scheduledRestaurant.schedules.map((schedule) => {
          // Destructure scheduled restaurant
          const { schedules, ...rest } = scheduledRestaurant;

          // Create new restaurant object
          return {
            ...rest,
            scheduledOn: schedule,
          };
        })
      )
      .flat(2)
      .sort(
        (a, b) =>
          convertDateToMilliseconds(a.scheduledOn) -
          convertDateToMilliseconds(b.scheduledOn)
      );

    // Return the scheduled restaurants with response
    res.status(200).json(scheduledRestaurants);
  } else {
    res.status(500);
    throw new Error("Something went wrong");
  }
});

// Schedule a restaurant
router.put("/schedule/:restaurantId", authUser, async (req, res) => {
  const { role } = req.user;
  const { date } = req.body;
  const { restaurantId } = req.params;

  // If date isn't provided
  if (!date) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // If provided date is a past date
  if (convertDateToMilliseconds(date) < Date.now()) {
    res.status(400);
    throw new Error("Cant' schedule a restaurant in the past");
  }

  // If role is admin
  if (role === "ADMIN") {
    // Find the restaurant and remove past dates
    const restaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      {
        $pull: {
          schedules: {
            $lt: Date.now(),
          },
        },
      },
      {
        returnDocument: "after",
      }
    ).select("-__v -updatedAt -createdAt -address");

    // If restaurant is found
    if (restaurant) {
      // Check if the restaurant is schedule on the same date
      const isScheduled = restaurant.schedules.find(
        (schedule) =>
          convertDateToMilliseconds(schedule) ===
          convertDateToMilliseconds(date)
      );

      // If the restaurant is already scheduled
      if (isScheduled) {
        res.status(401);
        throw new Error("Already scheduled on the provided date");
      }

      // Add the date to schedules
      restaurant.schedules.push(date);

      // Save the restaurant
      await restaurant.save();

      // Create scheduled restaurant
      const { __v, updatedAt, schedules, ...rest } = restaurant.toObject();

      // Create restaurant with scheduled date
      const scheduledRestaurant = { ...rest, scheduledOn: date };

      // Send updated restaurant with response
      res.status(201).json(scheduledRestaurant);
    } else {
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    res.status(401);
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
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      {
        $push: { items: { name, description, tags, price } },
      },
      {
        returnDocument: "after",
      }
    )
      .select("-__v -updatedAt")
      .lean();

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
      ).lean();

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
