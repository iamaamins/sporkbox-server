const bcrypt = require("bcrypt");
const express = require("express");
const User = require("../models/user");
const { setCookie, deleteFields } = require("../utils");
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

  // Check if vendor exists
  const vendorExists = await User.findOne({ email });

  // Throw error if vendor already exists
  if (vendorExists) {
    res.status(400);
    throw new Error("Vendor already exists");
  }

  // Create the restaurant
  const restaurant = await Restaurant.create({
    name: restaurantName,
    address: restaurantAddress,
  });

  // If restaurant is created successfully
  if (restaurant) {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create vendor and populate the restaurant
    const vendor = (
      await (
        await User.create({
          name,
          email,
          role: "VENDOR",
          status: "PENDING",
          password: hashedPassword,
          restaurant: restaurant.id,
        })
      ).populate("restaurant", "-__v -createdAt -updatedAt")
    ).toObject();

    // If vendor is created successfully
    if (vendor) {
      // Generate jwt token and set
      // cookie to the response header
      setCookie(res, vendor);

      // Delete fields
      deleteFields(vendor, ["password"]);

      // Send the vendor with response
      res.status(200).json(vendor);
    } else {
      // If vendor isn't created successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If restaurant isn't created successfully
    res.status(500);
    throw new Error("Something went wrong");
  }
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

  console.log(role);

  // If role is admin
  if (role === "ADMIN") {
    // Check if vendor exists
    const vendorExists = await User.findOne({ email });

    // Throw error if vendor already exists
    if (vendorExists) {
      res.status(400);
      throw new Error("Vendor already exists");
    }

    // Create the restaurant
    const restaurant = await Restaurant.create({
      name: restaurantName,
      address: restaurantAddress,
    });

    // If restaurant is created successfully
    if (restaurant) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create vendor and populate the restaurant
      const vendor = (
        await (
          await User.create({
            name,
            email,
            role: "VENDOR",
            status: "PENDING",
            password: hashedPassword,
            restaurant: restaurant.id,
          })
        ).populate("restaurant", "-__v -createdAt -updatedAt")
      ).toObject();

      // If vendor is created successfully
      if (vendor) {
        // Delete fields
        deleteFields(vendor, ["password"]);

        // Return the vendor
        res.status(200).json(vendor);
      } else {
        // If vendor isn't created successfully
        res.status(500);
        throw new Error("Something went wrong");
      }
    } else {
      // If restaurant isn't created successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If role isn't admin
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Get all the vendors
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
    // Fetch 20 latest vendors with restaurant data
    const vendors = await User.find({ role: "VENDOR" })
      .limit(limit)
      .select("-__v -password -updatedAt")
      .sort({ createdAt: -1 })
      .populate("restaurant", "-__v -updatedAt");

    // If vendors are fetched successfully
    if (vendors) {
      // Return the vendors
      res.status(200).json(vendors);
    } else {
      // If vendors are not fetched successfully
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
router.put("/:vendorId/status", authUser, async (req, res) => {
  // Get the role from req
  const { role } = req.user;
  const { action } = req.body;
  const { vendorId } = req.params;

  // If action or restaurant id aren't provided
  if (!action) {
    res.status(400);
    throw new Error("Please provide all the fields");
  }

  // If role is admin
  if (role === "ADMIN") {
    // Find the restaurant and update the status
    const updatedVendor = await User.findByIdAndUpdate(
      vendorId,
      {
        status: action === "Approve" ? "APPROVED" : "PENDING",
      },
      {
        returnDocument: "after",
      }
    ).select("-__v -password -updatedAt");

    // If status is updated successfully
    if (updatedVendor) {
      // Return the updated restaurant
      res.status(200).json(updatedVendor);
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

module.exports = router;
