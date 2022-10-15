const express = require("express");
const Order = require("../models/order");
const { deleteFields } = require("../utils");
const authUser = require("../middleware/authUser");
const { populate } = require("../models/user");

// Initialize router
const router = express.Router();

// Create an order
router.post("/create", authUser, async (req, res) => {
  // Get data from req user and body
  const { items } = req.body;
  const { id, role, company } = req.user;

  // If all the fields aren't provided
  if (!items) {
    res.status(401);
    throw new Error("Please provide all the fields");
  }

  // If role is customer
  if (role === "CUSTOMER") {
    // Create order items
    const orderItems = items.map((item) => ({
      customer: id,
      status: "PROCESSING",
      deliveryDate: item.date,
      company: company.toString(),
      restaurant: item.restaurant,
      item: {
        _id: item._id,
        name: item.name,
        total: item.total,
        quantity: item.quantity,
      },
    }));

    // Create orders
    const orders = await Order.insertMany(orderItems);

    // If order is created successfully
    if (orders) {
      // const updatedOrders = orders.map((order) => ({
      //   status: order.status,
      //   deliveryDate: order.deliveryDate,
      //   restaurant: order.restaurant,
      // }));

      console.log(orders);
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

  res.end();
});

module.exports = router;
