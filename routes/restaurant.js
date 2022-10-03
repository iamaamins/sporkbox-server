const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const setCookie = require("../utils");
const Restaurant = require("../models/restaurant");
const authUser = require("../middleware/authUser");

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
    role: "vendor",
    password: hashedPassword,
  });

  // If vendor is created successfully
  if (vendor) {
    // Generate jwt token and set cookie
    // to the response header
    setCookie(vendor.id, res, "vendor");

    // Create restaurant with vendor id
    const response = await Restaurant.create({
      owner: vendor.id,
      name: restaurantName,
      address: restaurantAddress,
      status: "Pending",
    });

    // If restaurant is created
    if (response) {
      // Fetch the restaurant with owner data
      const restaurant = await Restaurant.findById(response.id)
        .select("-__v -updatedAt")
        .populate("owner", "-__v -password -createdAt -updatedAt");

      // Send the data with response
      res.status(200).json(restaurant);
    } else {
      // If the restaurant isn't found
      res.status(400);
      throw new Error("Invalid restaurant data");
    }
  } else {
    // If vendor isn't created successfully
    res.status(500);
    throw new Error("Something went wrong");
  }
});

// Add an item to a restaurant
router.post("/:restaurantId/add-item", authUser, async (req, res) => {
  const { role } = req.user;
  const { restaurantId } = req.params;
  const { name, description, tags, price } = req.body;

  // If the role is either admin or vendor
  if (role === "admin" || role === "vendor") {
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

  // If role is admin
  if (role === "admin") {
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

  // If role is admin
  if (role === "admin") {
    // Find the restaurant and update the status
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      {
        status: action === "Approve" ? "Approved" : "Pending",
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
    if (role === "admin" || role === "vendor") {
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
