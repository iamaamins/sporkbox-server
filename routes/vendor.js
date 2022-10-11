const bcrypt = require("bcrypt");
const express = require("express");
const User = require("../models/user");
const setCookie = require("../utils");
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

    // Create vendor
    const vendor = await User.create({
      name,
      email,
      role: "VENDOR",
      status: "PENDING",
      password: hashedPassword,
      restaurant: restaurant.id,
    });

    // If vendor is created successfully
    if (vendor) {
      // Generate jwt token and set
      // cookie to the response header
      setCookie(res, vendor);

      // Find the vendor and populate the restaurant
      const response = await User.findById(vendor.id)
        .select("-__v -password -updatedAt")
        .populate("restaurant", "-__v -updatedAt");

      // If vendor is found successfully
      if (response) {
        // Send the data with response
        res.status(200).json(response);
      } else {
        // If vendor isn't found successfully
        res.status(500);
        throw new Error("Something went wrong");
      }
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

  // // Create a vendor
  // const vendor = await User.create({
  //   name,
  //   email,
  //   role: "VENDOR",
  //   password: hashedPassword,
  // });

  // // If vendor is created successfully
  // if (vendor) {
  //   // Generate jwt token and set
  //   // cookie to the response header
  //   setCookie(res, vendor);

  //   // Create restaurant with vendor id
  //   const response = await Restaurant.create({
  //     owner: vendor.id,
  //     status: "PENDING",
  //     name: restaurantName,
  //     address: restaurantAddress,
  //   });

  //   // If restaurant is created
  //   if (response) {
  //     // Fetch the restaurant with owner data
  //     const restaurant = await Restaurant.findById(response.id)
  //       .select("-__v -updatedAt")
  //       .populate("owner", "-__v -password -createdAt -updatedAt");

  //     // If restaurant is found
  //     if (restaurant) {
  //       // Send the data with response
  //       res.status(200).json(restaurant);
  //     } else {
  //       // If restaurant isn't found
  //       res.status(500);
  //       throw new Error("Something went wrong");
  //     }
  //   } else {
  //     // If the restaurant isn't created successfully
  //     res.status(500);
  //     throw new Error("Something went wrong");
  //   }
  // } else {
  //   // If vendor isn't created successfully
  //   res.status(500);
  //   throw new Error("Something went wrong");
  // }
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
      .select("-__v -updatedAt -password")
      .sort({ createdAt: -1 })
      .populate("restaurant", "-__v -createdAt -updatedAt");

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
    ).select("-__v -updatedAt -password");

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
