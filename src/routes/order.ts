import Order from "../models/order";
import authUser from "../middleware/authUser";
import express, { Request, Response } from "express";
import {
  sendEmail,
  convertDateToMS,
  convertDateToText,
  formatNumberToUS,
  getUpcomingWeekRestaurants,
} from "../utils";
import { IOrder, IOrderItem } from "../types";

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
      const customerActiveOrders = await Order.find({ customerId: _id })
        .where("status", "PROCESSING")
        .sort({ deliveryDate: 1 })
        .select(
          "-__v -updatedAt -customerId -customerName -customerEmail -deliveryAddress -companyName"
        );

      // If active orders are found successfully
      if (customerActiveOrders) {
        // Send the data with response
        res.status(200).json(customerActiveOrders);
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
        const customerDeliveredOrders = await Order.find({ customerId: _id })
          .where("status", "DELIVERED")
          .limit(+limit)
          .sort({ deliveryDate: -1 })
          .select(
            "-__v -updatedAt -customerId -customerName -customerEmail -deliveryAddress -companyName"
          );

        // If customer deliveredOrders are found successfully
        if (customerDeliveredOrders) {
          // Send the data with response
          res.status(200).json(customerDeliveredOrders);
        } else {
          // If delivered orders aren't found successfully
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
  const { orderItems } = req.body;

  // If items aren't provided
  if (!orderItems) {
    res.status(401);
    throw new Error("Please provide all the fields");
  }

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { _id, name, email, role, company } = req.user;

    // If role is customer
    if (role === "CUSTOMER" && company) {
      // Get upcoming week restaurants
      const upcomingWeekRestaurants = await getUpcomingWeekRestaurants();

      // Get customer active orders
      const customerActiveOrders = await Order.find({ customerId: _id })
        .where("status", "PROCESSING")
        .sort({ deliveryDate: 1 })
        .select("deliveryDate item");

      // If upcoming weeks restaurants and active orders are fetched successfully
      if (upcomingWeekRestaurants && customerActiveOrders) {
        // Check if the provided items are valid
        const itemsAreValid = orderItems.every((orderItem: IOrderItem) =>
          upcomingWeekRestaurants.some(
            (upcomingWeekRestaurant) =>
              upcomingWeekRestaurant._id.toString() ===
                orderItem.restaurantId &&
              convertDateToMS(upcomingWeekRestaurant.scheduledOn) ===
                orderItem.deliveryDate &&
              upcomingWeekRestaurant.items.some(
                (item) => item._id?.toString() === orderItem._id
              )
          )
        );

        // If provided items are valid
        if (itemsAreValid) {
          // Create orders
          const orders: IOrder[] = orderItems.map((orderItem: IOrderItem) => {
            // Find the restaurant
            const restaurant = upcomingWeekRestaurants.find(
              (upcomingWeekRestaurant) =>
                upcomingWeekRestaurant._id.toString() === orderItem.restaurantId
            );

            // Find the item
            const item = restaurant?.items.find(
              (item) => item._id?.toString() === orderItem._id
            );

            // Create and return the order object
            return {
              customerId: _id,
              customerName: name,
              customerEmail: email,
              status: "PROCESSING",
              companyName: company.name,
              deliveryAddress: company.address,
              restaurantName: restaurant?.name,
              restaurantId: orderItem.restaurantId,
              deliveryDate: orderItem.deliveryDate,
              item: {
                _id: orderItem._id,
                name: item?.name,
                quantity: orderItem.quantity,
                total: item?.price! * orderItem.quantity,
              },
            };
          });

          // Get next week dates and budget on hand
          const nextWeekBudgetAndDates = upcomingWeekRestaurants
            .map((upcomingWeekRestaurant) =>
              convertDateToMS(upcomingWeekRestaurant.scheduledOn)
            )
            .filter((date, index, dates) => dates.indexOf(date) === index)
            .map((nextWeekDate) => {
              // Find the active orders those match the date
              const nextWeekDateActiveOrders = customerActiveOrders.filter(
                (customerActiveOrder) =>
                  convertDateToMS(customerActiveOrder.deliveryDate) ===
                  nextWeekDate
              );

              // If active orders are found on the date
              if (nextWeekDateActiveOrders.length > 0) {
                // Get active orders total on the date
                const nextWeekDateActiveOrdersTotal =
                  nextWeekDateActiveOrders.reduce(
                    (acc, nextWeekActiveOrder) =>
                      acc + nextWeekActiveOrder.item.total,
                    0
                  );

                // Return the date and company budget - active orders total
                return {
                  nextWeekDate,
                  budgetOnHand: formatNumberToUS(
                    company.dailyBudget - nextWeekDateActiveOrdersTotal
                  ),
                };
              } else {
                // If no active orders are found with the
                // date then return the date and company budget
                return {
                  nextWeekDate,
                  budgetOnHand: company.dailyBudget,
                };
              }
            });

          // Check if the daily budget has exceeded
          const hasDailyBudgetExceeded = nextWeekBudgetAndDates.some(
            (nextWeekBudgetAndDate) => {
              return (
                nextWeekBudgetAndDate.budgetOnHand -
                  orders
                    .filter(
                      (order) =>
                        order.deliveryDate ===
                        nextWeekBudgetAndDate.nextWeekDate
                    )
                    .reduce((acc, order) => acc + order.item.total, 0) <
                0
              );
            }
          );

          // If daily budget has exceeded
          if (hasDailyBudgetExceeded) {
            res.status(400);
            throw new Error("One of your orders has exceeded the daily budget");
          }

          // Create orders
          const response = await Order.insertMany(orders);

          // If orders are created successfully
          if (response) {
            // Format orders for customer
            const customerOrders = response.map((order) => ({
              _id: order._id,
              item: order.item,
              status: order.status,
              createdAt: order.createdAt,
              hasReviewed: order.hasReviewed,
              restaurantId: order.restaurantId,
              deliveryDate: order.deliveryDate,
              restaurantName: order.restaurantName,
            }));

            // Send the data with response
            res.status(201).json(customerOrders);
          } else {
            // If orders aren't created successfully
            res.status(500);
            throw new Error("Something went wrong");
          }
        } else {
          // If there is an invalid item
          res.status(400);
          throw new Error("Invalid orders");
        }
      } else {
        // If upcoming weeks restaurants and customer active orders aren't fetched successfully
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
