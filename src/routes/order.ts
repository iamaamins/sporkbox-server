import { IOrderItem } from "../types";
import Order from "../models/order";
import authUser from "../middleware/authUser";
import express, { Request, Response } from "express";
import { convertDateToText, sendEmail } from "../utils";

// Initialize router
const router = express.Router();

// Get customer's active orders
router.get("/me/active", authUser, async (req: Request, res: Response) => {
  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { _id, role } = req.user;

    // If role is customer
    if (role === "CUSTOMER") {
      // Find the active orders of the customer
      const activeOrders = await Order.find({ customerId: _id })
        .where("status", "PROCESSING")
        .sort({ deliveryDate: 1 })
        .select(
          "_id createdAt status item restaurantId restaurantName deliveryDate"
        );

      // If active orders are found successfully
      if (activeOrders) {
        // Send the data with response
        res.status(200).json(activeOrders);
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
  } else {
    // If there is no user
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Get customer's delivered orders
router.get(
  "/me/delivered/:limit",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure req data
    const { limit } = req.params;

    // If there is an user
    if (req.user) {
      const { role, _id } = req.user;
      // If role is customer

      if (role === "CUSTOMER") {
        // Find the active orders of the customer
        const orders = await Order.find({ customerId: _id })
          .where("status", "DELIVERED")
          .limit(+limit)
          .sort({ deliveryDate: -1 })
          .select(
            "_id createdAt status item restaurantId restaurantName deliveryDate"
          );

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
    } else {
      // If there is no user
      res.status(401);
      throw new Error("Not authorized");
    }
  }
);

// Create orders
router.post("/create", authUser, async (req: Request, res: Response) => {
  // Get data from req user and body
  const { items } = req.body;

  // If items aren't provided
  if (!items) {
    res.status(401);
    throw new Error("Please provide all the fields");
  }

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { _id, name, email, role, company } = req.user;

    // If role is customer
    if (role === "CUSTOMER" && company) {
      // Create order items
      const orderItems = items.map((item: IOrderItem) => ({
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
          _id: order._id,
          item: order.item,
          status: order.status,
          createdAt: order.createdAt,
          restaurantId: order.restaurantId,
          deliveryDate: order.deliveryDate,
          restaurantName: order.restaurantName,
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
  } else {
    // If there is no user
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Get all active orders
router.get("/active", authUser, async (req: Request, res: Response) => {
  // Check if there is an user
  if (req.user) {
    // Get data from req user
    const { role } = req.user;

    // If role is admin
    if (role === "ADMIN") {
      // Find the active orders
      const response = await Order.find({ status: "PROCESSING" })
        .sort({ deliveryDate: 1 })
        .select("-__v -updatedAt");

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
  } else {
    // If there is no user
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Get all delivered orders
router.get(
  "/delivered/:limit",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { limit } = req.params;

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin
      if (role === "ADMIN") {
        // Get delivered orders
        const response = await Order.find({ status: "DELIVERED" })
          .limit(+limit)
          .sort({ deliveryDate: -1 })
          .select("-__v -updatedAt");

        // If orders are found successfully
        if (response) {
          // Convert date
          const deliveredOrders = response.map((deliveredOrder) => ({
            ...deliveredOrder.toObject(),
            deliveryDate: convertDateToText(deliveredOrder.deliveryDate),
          }));

          // Send delivered orders with response
          res.status(200).json(deliveredOrders);
        } else {
          // If orders aren't found successfully
          res.status(500);
          throw new Error("Something went wrong");
        }
      } else {
        // If role isn't admin
        res.status(401);
        throw new Error("Not authorized");
      }
    } else {
      // If there is no user
      res.status(401);
      throw new Error("Not authorized");
    }
  }
);

// Update order status
router.put(
  "/:orderId/status",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { orderId } = req.params;

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

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

        // If order is updated successfully
        if (response) {
          // Get customer name and email from the order
          const { customerName, customerEmail } = response;

          // Send email to the customer
          sendEmail(customerName as string, customerEmail as string);

          // Format delivery date date
          const updatedOrder = {
            ...response,
            deliveryDate: convertDateToText(response.deliveryDate),
          };

          // Send the update
          res.status(200).json(updatedOrder);
        } else {
          // If order isn't updated successfully
          res.status(500);
          throw new Error("Something went wrong");
        }
      } else {
        // If role isn't admin
        res.status(401);
        throw new Error("Not authorized");
      }
    } else {
      // If there is no user
      res.status(401);
      throw new Error("Not authorized");
    }
  }
);

export default router;
