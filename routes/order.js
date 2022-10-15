const express = require("express");
const Order = require("../models/order");
const { deleteFields } = require("../utils");
const authUser = require("../middleware/authUser");

// Initialize router
const router = express.Router();

// Create an order
router.post("/create", authUser, async (req, res) => {
  // Get data from req user and body
  const { id, role } = req.user;
  const { items, total } = req.body;

  // If all the fields aren't provided
  if (!items || !total) {
    res.status(401);
    throw new Error("Please provide all the fields");
  }

  // If role is customer
  if (role === "CUSTOMER") {
    // Post the data to db
    const order = (
      await Order.create({ customer: id, items, total })
    ).toObject();

    // If order is created successfully
    if (order) {
      // Delete fields
      deleteFields(order);

      console.log(order);
    } else {
      // If order isn't created successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If role isn't customer
    res.status(401);
    throw new Error("Not authorized");
  }
});

module.exports = router;
