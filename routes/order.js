const express = require("express");
const Order = require("../models/order");
const { deleteFields } = require("../utils");
const authUser = require("../middleware/authUser");

// Initialize router
const router = express.Router();

// Create an order
router.post("/create", authUser, async (req, res) => {
  // Get data from req user and body
  const { items } = req.body;
  const { id, name, email, role, company } = req.user;

  // If items aren't provided
  if (!items) {
    res.status(401);
    throw new Error("Please provide all the fields");
  }

  // If role is customer
  if (role === "CUSTOMER") {
    // Create order items
    const orderItems = items.map((item) => ({
      customer: id,
      customerName: name,
      customerEmail: email,
      status: "PROCESSING",
      company: company.id,
      companyName: company.name,
      restaurant: item.restaurant,
      deliveryDate: item.deliveryDate,
      deliveryAddress: company.address,
      restaurantName: item.restaurantName,
      item: {
        _id: item._id,
        name: item.name,
        total: item.total,
        quantity: item.quantity,
      },
    }));

    // Create orders
    const response = await Order.insertMany(orderItems);

    // If orders are created successfully
    if (response) {
      // Create return data
      const orders = response.map((order) => ({
        item: order.item,
        status: order.status,
        deliveryDate: order.deliveryDate,
        restaurantName: order.restaurantName,
        deliveryAddress: order.deliveryAddress,
      }));

      // Send the data with response
      res.status(201).json(orders);
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
