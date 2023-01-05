import Order from "../models/order";
import authUser from "../middleware/authUser";
import express, { Request, Response } from "express";
import {
  convertDateToMS,
  formatNumberToUS,
  getUpcomingWeekRestaurants,
} from "../utils";
import {
  orderArchiveTemplate,
  orderDeliveryTemplate,
} from "../utils/emailTemplates";
import mail from "@sendgrid/mail";
import { IOrdersPayload, IOrdersStatusPayload } from "./../types/index.d";

// Initialize router
const router = express.Router();

// Get customer's upcoming orders
router.get(
  "/me/upcoming-orders",
  authUser,
  async (req: Request, res: Response) => {
    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { _id, role } = req.user;

      // If role is customer
      if (role === "CUSTOMER") {
        try {
          // Find the upcoming orders of the customer
          const customerUpcomingOrders = await Order.find({
            "customer._id": _id,
            status: "PROCESSING",
          })
            .sort({ "delivery.date": 1 })
            .select("-__v -updatedAt -customer -delivery.address -company");

          // Send the data with response
          res.status(200).json(customerUpcomingOrders);
        } catch (err) {
          // If upcoming orders aren't fetched successfully
          throw err;
        }
      } else {
        // If role isn't customer
        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Get customer's delivered orders
router.get(
  "/me/delivered-orders/:limit",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure req data
    const { limit } = req.params;

    // If there is an user
    if (req.user) {
      const { role, _id } = req.user;

      // If role is customer
      if (role === "CUSTOMER") {
        try {
          // Find the delivered orders of the customer
          const customerDeliveredOrders = await Order.find({
            "customer._id": _id,
            status: "DELIVERED",
          })
            .limit(+limit)
            .sort({ "delivery.date": -1 })
            .select("-__v -updatedAt -customer -delivery.address -company");

          // Send the data with response
          res.status(200).json(customerDeliveredOrders);
        } catch (err) {
          // If delivered orders aren't fetched successfully
          throw err;
        }
      } else {
        // If role isn't customer
        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Create orders
router.post("/create-orders", authUser, async (req: Request, res: Response) => {
  // Get data from req user and body
  const { ordersPayload }: IOrdersPayload = req.body;

  // If required data aren't provided
  if (
    !ordersPayload ||
    !ordersPayload.every(
      (orderPayload) =>
        orderPayload.itemId &&
        orderPayload.quantity &&
        orderPayload.restaurantId &&
        orderPayload.deliveryDate
    )
  ) {
    res.status(401);
    throw new Error("Please provide all the orders data");
  }

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { _id, firstName, lastName, email, role, company } = req.user;

    // If role is customer
    if (role === "CUSTOMER" && company) {
      // Get upcoming week restaurants
      const upcomingWeekRestaurants = await getUpcomingWeekRestaurants(
        company.name
      );

      try {
        // Get customer upcoming orders
        const customerUpcomingOrders = await Order.find({
          "customer._id": _id,
          status: "PROCESSING",
        })
          .select("delivery item")
          .sort({ "delivery.date": 1 });

        // Check if the provided items are valid
        const itemsAreValid = ordersPayload.every((orderPayload) =>
          upcomingWeekRestaurants.some(
            (upcomingWeekRestaurant) =>
              upcomingWeekRestaurant._id.toString() ===
                orderPayload.restaurantId &&
              convertDateToMS(upcomingWeekRestaurant.date) ===
                orderPayload.deliveryDate &&
              upcomingWeekRestaurant.items.some(
                (item) => item._id?.toString() === orderPayload.itemId
              )
          )
        );

        // If items are not valid
        if (!itemsAreValid) {
          res.status(400);
          throw new Error("Orders are not valid");
        }

        // Create orders
        const orders = ordersPayload.map((orderPayload) => {
          // Find the restaurant
          const restaurant = upcomingWeekRestaurants.find(
            (upcomingWeekRestaurant) =>
              upcomingWeekRestaurant._id.toString() ===
              orderPayload.restaurantId
          );

          // If restaurant is found
          if (restaurant) {
            // Find the item
            const item = restaurant.items.find(
              (item) => item._id?.toString() === orderPayload.itemId
            );

            // If the item is found
            if (item) {
              // Discount item price to company budget
              const unitPrice =
                item.price > company.dailyBudget
                  ? company.dailyBudget
                  : item.price;

              // Return individual order
              return {
                customer: {
                  _id: _id,
                  firstName,
                  lastName,
                  email,
                },
                restaurant: {
                  _id: orderPayload.restaurantId,
                  name: restaurant.name,
                },
                company: {
                  _id: company._id,
                  name: company.name,
                },
                delivery: {
                  date: orderPayload.deliveryDate,
                  address: company.address,
                },
                status: "PROCESSING",
                item: {
                  _id: orderPayload.itemId,
                  name: item.name,
                  tags: item.tags,
                  description: item.description,
                  quantity: orderPayload.quantity,
                  total: unitPrice * orderPayload.quantity,
                },
              };
            } else {
              // If item isn't found
              res.status(400);
              throw new Error("Item is not found");
            }
          } else {
            // If restaurant isn't found
            res.status(400);
            throw new Error("Restaurant is not found");
          }
        });

        // Get next week dates and budget on hand
        const nextWeekBudgetAndDates = upcomingWeekRestaurants
          .map((upcomingWeekRestaurant) =>
            convertDateToMS(upcomingWeekRestaurant.date)
          )
          .filter((date, index, dates) => dates.indexOf(date) === index)
          .map((nextWeekDate) => {
            // Find the upcoming orders which match the date
            const upcomingOrdersOnADateNextWeek = customerUpcomingOrders.filter(
              (customerUpcomingOrder) =>
                convertDateToMS(customerUpcomingOrder.delivery.date) ===
                nextWeekDate
            );

            // If upcoming orders are found on the date
            if (upcomingOrdersOnADateNextWeek.length > 0) {
              // Get upcoming orders total on the date
              const upcomingOrdersTotalOnADateNextWeek =
                upcomingOrdersOnADateNextWeek.reduce(
                  (acc, upcomingOrderOnADateNextWeek) =>
                    acc + upcomingOrderOnADateNextWeek.item.total,
                  0
                );

              // Return the date and company budget - upcoming orders total
              return {
                nextWeekDate,
                budgetOnHand: formatNumberToUS(
                  company.dailyBudget - upcomingOrdersTotalOnADateNextWeek
                ),
              };
            } else {
              // If no upcoming orders are found with the
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
                      order.delivery.date === nextWeekBudgetAndDate.nextWeekDate
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

        try {
          // Create orders
          const response = await Order.insertMany(orders);

          // Format orders for customer
          const customerOrders = response.map((order) => ({
            _id: order._id,
            item: order.item,
            status: order.status,
            createdAt: order.createdAt,
            restaurant: order.restaurant,
            delivery: {
              date: order.delivery.date,
            },
            hasReviewed: order.hasReviewed,
          }));

          // Send the data with response
          res.status(201).json(customerOrders);
        } catch (err) {
          // If orders aren't created
          throw err;
        }
      } catch (err) {
        // If upcoming orders aren't fetched
        throw err;
      }
    } else {
      // If role isn't customer
      res.status(403);
      throw new Error("Not authorized");
    }
  }
});

// Get all upcoming orders
router.get(
  "/all-upcoming-orders",
  authUser,
  async (req: Request, res: Response) => {
    // Check if there is an user
    if (req.user) {
      // Get data from req user
      const { role } = req.user;

      // If role is admin
      if (role === "ADMIN") {
        try {
          // Find the upcoming orders
          const upcomingOrders = await Order.find({ status: "PROCESSING" })
            .select("-__v -updatedAt")
            .sort({ "delivery.date": 1 });

          // Send the data with response
          res.status(200).json(upcomingOrders);
        } catch (err) {
          // If upcoming orders aren't fetched successfully
          throw err;
        }
      } else {
        // If role isn't admin
        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Get all delivered orders
router.get(
  "/all-delivered-orders/:limit",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { limit } = req.params;

    // If all the fields aren't provided
    if (!limit) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin
      if (role === "ADMIN") {
        try {
          // Get delivered orders
          const deliveredOrders = await Order.find({ status: "DELIVERED" })
            .limit(+limit)
            .select("-__v -updatedAt")
            .sort({ "delivery.date": -1 });

          // Send delivered orders with response
          res.status(200).json(deliveredOrders);
        } catch (err) {
          // If delivered orders aren't fetched successfully
          throw err;
        }
      } else {
        // If role isn't admin
        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Change bulk orders and send delivery email
router.patch(
  "/change-orders-status",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { orderIds }: IOrdersStatusPayload = req.body;

    // If order ids aren't provides
    if (!orderIds) {
      res.status(400);
      throw new Error("Please provide order ids");
    }

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin
      if (role === "ADMIN") {
        try {
          // Update orders status
          await Order.updateMany(
            { _id: { $in: orderIds }, status: "PROCESSING" },
            { $set: { status: "DELIVERED" } }
          );

          try {
            // Find the orders
            const orders = await Order.find({ _id: { $in: orderIds } });

            try {
              // Send delivery email
              await Promise.all(
                orders.map(
                  async (order) =>
                    await mail.send(orderDeliveryTemplate(order.toObject()))
                )
              );

              // Send the update
              res.status(200).json("Delivery email sent");
            } catch (err) {
              // If emails aren't sent
              res.status(500);
              throw new Error("Failed to send email");
            }
          } catch (err) {
            // If orders aren't fetched
            res.status(500);
            throw err;
          }
        } catch (err) {
          // If order status isn't updated
          res.status(500);
          throw err;
        }
      } else {
        // If role isn't admin
        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Change single order status
router.patch(
  "/:orderId/change-order-status",
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
        try {
          // Update order status
          const updatedOrder = await Order.findOneAndUpdate(
            { _id: orderId, status: "PROCESSING" },
            {
              status: "ARCHIVED",
            },
            { returnDocument: "after" }
          )
            .select("-__v -updatedAt")
            .orFail();

          // If order is updated successfully
          try {
            // Send cancellation email
            await mail.send(orderArchiveTemplate(updatedOrder.toObject()));

            // Send updated order with the response
            res.status(201).json(updatedOrder);
          } catch (err) {
            // If email isn't sent successfully
            throw err;
          }
        } catch (err) {
          // If order status isn't updated successfully
          throw err;
        }
      } else {
        // If role isn't admin
        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

export default router;
