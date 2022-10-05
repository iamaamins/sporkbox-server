const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const Restaurant = require("../models/restaurant");
const authUser = require("../middleware/authUser");

// Initialize router
const router = express.Router();

// Get all the scheduled restaurants
router.get("/scheduled", async (req, res) => {
  // Now
  const now = new Date();

  // This week Sunday and Friday
  const currSunday = now.getDate() - now.getDay();
  var currFriday = currSunday + 12;

  // Next week Sunday and Friday
  var nextSunday = new Date(now.setDate(currSunday + 6));
  var nextFriday = new Date(now.setDate(currFriday));

  // Get the restaurants scheduled from next sunday to next friday
  const restaurants = await Restaurant.find({
    scheduledOn: {
      $gte: new Date(nextSunday),
      $lt: new Date(nextFriday),
    },
  });

  console.log(restaurants);

  res.status(200).json(restaurants);
});

// Add a vendor and a restaurant
router.post("/add", authUser, async (req, res) => {
  // Get data from req
  const { role } = req.user;
  const { name, email, password, restaurantName, restaurantAddress } = req.body;

  // If a value isn't provided
  if (!name || !email || !password || !restaurantName || !restaurantAddress) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  if (role === "ADMIN") {
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

    // Create a vendor
    const vendor = await User.create({
      name,
      email,
      role: "VENDOR",
      password: hashedPassword,
    });

    // If vendor is created successfully
    if (vendor) {
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
        // If the restaurant isn't created
        res.status(500);
        throw new Error("Something went wrong");
      }
    } else {
      // If vendor isn't created successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If role isn't admin
    res.status(401);
    throw new Error("Not authorized");
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

// Get all the restaurants
router.get("/:limit", authUser, async (req, res) => {
  // Get the role from req
  const { role } = req.user;
  const { limit } = req.params;

  // If limit isn't provided
  if (!limit) {
    res.status(400);
    throw new Error("Please provide all the fields");
  }

  // If role is admin
  if (role === "ADMIN") {
    // Fetch 20 latest restaurants with owner data
    const restaurants = await Restaurant.find()
      .limit(limit)
      .select("-__v -updatedAt")
      .sort({ createdAt: -1 })
      .populate("owner", "-__v -password -createdAt -updatedAt");

    // If restaurants are fetched successfully
    if (restaurants) {
      // Return the restaurants
      res.status(200).json(restaurants);
    } else {
      // If restaurants are not fetched successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // Return not authorized if role isn't admin
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Update restaurant status
router.put("/:restaurantId/status", authUser, async (req, res) => {
  // Get the role from req
  const { role } = req.user;
  const { action } = req.body;
  const { restaurantId } = req.params;

  // If action or restaurant id aren't provided
  if (!action) {
    res.status(400);
    throw new Error("Please provide all the fields");
  }

  // If role is admin
  if (role === "ADMIN") {
    // Find the restaurant and update the status
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      {
        status: action === "Approve" ? "APPROVED" : "PENDING",
      },
      {
        returnDocument: "after",
      }
    ).select("-__v -updatedAt");

    // If status is updated successfully
    if (updatedRestaurant) {
      // Return the updated restaurant
      res.status(200).json(updatedRestaurant);
    } else {
      // If status isn't updated successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // Return not authorized if role isn't admin
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
    ).select("-__v -updatedAt -createdAt -owner");

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
