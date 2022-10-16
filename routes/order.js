const express = require("express");
const Order = require("../models/order");
const { deleteFields, convertDateToText } = require("../utils");
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

// Get active orders
router.get("/active", authUser, async (req, res) => {
  // Get data from req user
  const { role } = req.user;

  // If role is admin
  if (role === "ADMIN") {
    // Find the active orders
    const response = await Order.find({ status: "PROCESSING" }).select(
      "-__v -updatedAt"
    );

    // If active orders are found successfully
    if (response) {
      // Format the delivery date of each order
      const activeOrders = response.map((activeOrder) => ({
        ...activeOrder.toObject(),
        deliveryDate: convertDateToText(activeOrder.deliveryDate),
      }));

      // Send the data with response
      res.status(200).json(activeOrders);
    } else {
      // If active orders aren't found successfully
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
