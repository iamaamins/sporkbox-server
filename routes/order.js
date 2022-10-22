const express = require("express");
const Order = require("../models/order");
const authUser = require("../middleware/authUser");
const { convertDateToText, sendEmail } = require("../utils");

// Initialize router
const router = express.Router();

// Get customer's orders
router.get("/me/active", authUser, async (req, res) => {
  const { role, _id } = req.user;

  // If role is customer
  if (role == "CUSTOMER") {
    // Find the active orders of the customer
    const orders = await Order.find({ customerId: _id })
      .where("status", "PROCESSING")
      .select(" _id createdAt status item restaurantName deliveryDate    ")
      .lean();

    // If orders are found successfully
    if (orders) {
      // Send the data with response
      res.status(200).json(orders);
    } else {
      // If orders aren't found successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If role isn't customer
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Get customer's orders
router.get("/me/delivered/:limit", authUser, async (req, res) => {
  // Destructure req data
  const { limit } = req.params;
  const { role, _id } = req.user;

  // If role is customer
  if (role == "CUSTOMER") {
    // Find the active orders of the customer
    const orders = await Order.find({ customerId: _id })
      .where("status", "DELIVERED")
      .select(" _id createdAt status item restaurantName deliveryDate    ")
      .limit(+limit)
      .lean();

    // If orders are found successfully
    if (orders) {
      // Send the data with response
      res.status(200).json(orders);
    } else {
      // If orders aren't found successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If role isn't customer
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Create an order
router.post("/create", authUser, async (req, res) => {
  // Get data from req user and body
  const { items } = req.body;
  const { _id, name, email, role, company } = req.user;

  // If items aren't provided
  if (!items) {
    res.status(401);
    throw new Error("Please provide all the fields");
  }

  // If role is customer
  if (role === "CUSTOMER") {
    // Create order items
    const orderItems = items.map((item) => ({
      customerId: _id,
      customerName: name,
      customerEmail: email,
      status: "PROCESSING",
      companyName: company.name,
      restaurantId: item.restaurantId,
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
        restaurantName: order.restaurantName,
        deliveryAddress: order.deliveryAddress,
        deliveryDate: convertDateToText(order.deliveryDate),
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

// Get all delivered orders
router.get("/:limit", authUser, async (req, res) => {
  // Destructure data from req
  const { role } = req.user;
  const { limit } = req.params;

  // If no limit is provided
  if (!limit) {
    res.status(401);
    throw new Error("Please provide all the fields");
  }

  // If role is admin
  if (role === "ADMIN") {
    // Get all delivered orders
    const response = await Order.find({ status: "DELIVERED" })
      .limit(+limit)
      .sort({ createdAt: -1 })
      .select("-__v -updatedAt");

    // If orders are fetched successfully
    if (response) {
      // Convert date
      const deliveredOrders = response.map((activeOrder) => ({
        ...activeOrder.toObject(),
        deliveryDate: convertDateToText(activeOrder.deliveryDate),
      }));

      // Send delivered orders with response
      res.status(200).json(deliveredOrders);
    } else {
      // If orders aren't fetched successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Update order status
router.put("/:orderId/status", authUser, async (req, res) => {
  // Get role and order id from req
  const { role } = req.user;
  const { orderId } = req.params;

  // If role is admin
  if (role === "ADMIN") {
    // Find the order and update the status
    const response = await Order.findByIdAndUpdate(
      orderId,
      {
        status: "DELIVERED",
      },
      {
        returnDocument: "after",
      }
    )
      .select("-__v -updatedAt")
      .lean();

    // If order is updates successfully
    if (response) {
      // Get customer name and email from the order
      const { customerName, customerEmail } = response;

      // Send email to the customer
      sendEmail(customerName, customerEmail);

      // Format delivery date date
      const updatedOrder = {
        ...response,
        deliveryDate: convertDateToText(response.deliveryDate),
      };

      // Send the update
      res.status(200).json(updatedOrder);
    } else {
      // If order is updates successfully
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
