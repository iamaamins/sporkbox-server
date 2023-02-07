import Order from "../models/order";
import authUser from "../middleware/authUser";
import express, { Request, Response } from "express";
import {
  convertDateToMS,
  convertDateToText,
  formatNumberToUS,
  generateRandomString,
  getUpcomingRestaurants,
} from "../utils";
import {
  orderArchiveTemplate,
  orderDeliveryTemplate,
} from "../utils/emailTemplates";
import mail from "@sendgrid/mail";
import { stripeCheckout } from "../config/stripe";
import { IOrdersPayload, IOrdersStatusPayload } from "./../types/index.d";

// Initialize router
const router = express.Router();

// Get customer's all upcoming orders
router.get(
  "/me/upcoming-orders",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { _id, role } = req.user;

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

// Get customer's limited delivered orders
router.get(
  "/me/delivered-orders/:limit",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role, _id } = req.user;

      if (role === "CUSTOMER") {
        // Destructure req data
        const { limit } = req.params;

        // If all the fields aren't provided
        if (!limit) {
          res.status(400);
          throw new Error("Please provide all the fields");
        }

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
  if (req.user) {
    // Destructure data from req
    const { _id, firstName, lastName, email, role, company } = req.user;

    if (role === "CUSTOMER" && company) {
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
        throw new Error("Please provide valid orders data");
      }

      // Get upcoming week restaurants
      const upcomingWeekRestaurants = await getUpcomingRestaurants(
        company.name
      );

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
            upcomingWeekRestaurant._id.toString() === orderPayload.restaurantId
        );

        if (restaurant) {
          // Find the item
          const item = restaurant.items.find(
            (item) => item._id?.toString() === orderPayload.itemId
          );

          if (item) {
            // Create and return individual order
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
                address: {
                  city: company.address.city,
                  state: company.address.state,
                  zip: company.address.zip,
                  addressLine1: company.address.addressLine1,
                  addressLine2: company.address.addressLine2,
                },
              },
              status: "PROCESSING",
              item: {
                _id: orderPayload.itemId,
                name: item.name,
                tags: item.tags,
                description: item.description,
                quantity: orderPayload.quantity,
                image: item.image || restaurant.logo,
                total: item.price * orderPayload.quantity,
                addedIngredients: orderPayload.addedIngredients,
                removedIngredients: orderPayload.removedIngredients,
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

      try {
        // Get customer upcoming orders
        const customerUpcomingOrders = await Order.find({
          "customer._id": _id,
          status: "PROCESSING",
        })
          .select("delivery item")
          .sort({ "delivery.date": 1 });

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

              // Return the date and budget on hand
              return {
                nextWeekDate,
                budgetOnHand:
                  upcomingOrdersTotalOnADateNextWeek > company.dailyBudget
                    ? 0
                    : formatNumberToUS(
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

        // Create payable items with date and amount
        const payableItems = nextWeekBudgetAndDates
          .map((nextWeekBudgetAndDate) => {
            return {
              date: convertDateToText(nextWeekBudgetAndDate.nextWeekDate),
              items: orders
                .filter(
                  (order) =>
                    order.delivery.date === nextWeekBudgetAndDate.nextWeekDate
                )
                .map((order) => order.item.name),
              amount:
                nextWeekBudgetAndDate.budgetOnHand -
                orders
                  .filter(
                    (order) =>
                      order.delivery.date === nextWeekBudgetAndDate.nextWeekDate
                  )
                  .reduce((acc, order) => acc + order.item.total, 0),
            };
          })
          .filter((payableItem) => payableItem.amount < 0);

        if (payableItems.length > 0) {
          // Create random pending Id
          const pendingOrderId = generateRandomString();

          // Create stripe checkout sessions
          const session = await stripeCheckout(
            email,
            pendingOrderId,
            payableItems
          );

          // Create pending orders
          const pendingOrders = orders.map((order) => ({
            ...order,
            pendingOrderId,
            status: "PENDING",
          }));

          try {
            // Create orders
            await Order.insertMany(pendingOrders);

            // Send the session url with response
            res.status(200).json(session.url);
          } catch (err) {
            // If orders fails to create
            throw err;
          }
        } else {
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
            // If orders fails to create
            throw err;
          }
        }
      } catch (err) {
        // If upcoming orders fails to fetch
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
    if (req.user) {
      // Get data from req user
      const { role } = req.user;

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

// Get limited delivered orders
router.get(
  "/all-delivered-orders/:limit",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        // Destructure data from req
        const { limit } = req.params;

        // If all the fields aren't provided
        if (!limit) {
          res.status(400);
          throw new Error("Please provide all the fields");
        }

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

// Get all delivered orders of a customer
router.get(
  "/:customerId/all-delivered-orders",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        // Destructure data from req
        const { customerId } = req.params;

        try {
          const customerDeliveredOrders = await Order.find({
            "customer._id": customerId,
            status: "DELIVERED",
          })
            .sort({ "delivery.date": -1 })
            .select("-__v -updatedAt");

          // Send orders with response
          res.status(200).json(customerDeliveredOrders);
        } catch (err) {
          // If orders aren't found
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
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        // Destructure data from req
        const { orderIds }: IOrdersStatusPayload = req.body;

        // If order ids aren't provides
        if (!orderIds) {
          res.status(400);
          throw new Error("Please provide order ids");
        }

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
              throw err;
            }
          } catch (err) {
            // If orders aren't fetched
            throw err;
          }
        } catch (err) {
          // If order status isn't updated
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
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        // Destructure data from req
        const { orderId } = req.params;

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

          // If order is updated
          try {
            // Send cancellation email
            await mail.send(orderArchiveTemplate(updatedOrder.toObject()));

            // Send updated order with the response
            res.status(201).json(updatedOrder);
          } catch (err) {
            // If email isn't sent
            throw err;
          }
        } catch (err) {
          // If order status isn't updated
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
