import { IOrdersPayload } from "./../types/index.d";
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

// Initialize router
const router = express.Router();

// Get customer's upcoming orders
router.get("/me/upcoming", authUser, async (req: Request, res: Response) => {
  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { _id, role } = req.user;

    // If role is customer
    if (role === "CUSTOMER") {
      // Find the upcoming orders of the customer
      const customerUpcomingOrders = await Order.find({ "customer.id": _id })
        .where("status", "PROCESSING")
        .sort({ "delivery.date": 1 })
        .select("-__v -updatedAt -customer -delivery.address -company");

      // If upcoming orders are found successfully
      if (customerUpcomingOrders) {
        // Send the data with response
        res.status(200).json(customerUpcomingOrders);
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
        // Find the upcoming orders of the customer
        const customerDeliveredOrders = await Order.find({ "customer.id": _id })
          .where("status", "DELIVERED")
          .limit(+limit)
          .sort({ "delivery.date": -1 })
          .select("-__v -updatedAt -customer -delivery.address -company");

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
    throw new Error("Please provide all orders data");
  }

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { _id, firstName, lastName, email, role, company } = req.user;

    // If role is customer
    if (role === "CUSTOMER" && company) {
      // Get upcoming week restaurants
      const upcomingWeekRestaurants = await getUpcomingWeekRestaurants();

      // Get customer upcoming orders
      const customerUpcomingOrders = await Order.find({ "customer.id": _id })
        .where("status", "PROCESSING")
        .select("delivery item")
        .sort({ "delivery.date": 1 });

      // If upcoming weeks restaurants and upcoming orders are fetched successfully
      if (upcomingWeekRestaurants && customerUpcomingOrders) {
        // Check if the provided items are valid
        const itemsAreValid = ordersPayload.every((orderPayload) =>
          upcomingWeekRestaurants.some(
            (upcomingWeekRestaurant) =>
              upcomingWeekRestaurant._id.toString() ===
                orderPayload.restaurantId &&
              convertDateToMS(upcomingWeekRestaurant.scheduledOn) ===
                orderPayload.deliveryDate &&
              upcomingWeekRestaurant.items.some(
                (item) => item._id?.toString() === orderPayload.itemId
              )
          )
        );

        // If provided items are valid
        if (itemsAreValid) {
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
                    id: _id,
                    firstName,
                    lastName,
                    email,
                  },
                  restaurant: {
                    id: orderPayload.restaurantId,
                    name: restaurant.name,
                  },
                  company: {
                    name: company.name,
                  },
                  delivery: {
                    date: orderPayload.deliveryDate,
                    address: company.address,
                  },
                  status: "PROCESSING",
                  item: {
                    id: orderPayload.itemId,
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
              convertDateToMS(upcomingWeekRestaurant.scheduledOn)
            )
            .filter((date, index, dates) => dates.indexOf(date) === index)
            .map((nextWeekDate) => {
              // Find the upcoming orders which match the date
              const upcomingOrdersOnADateNextWeek =
                customerUpcomingOrders.filter(
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
                        order.delivery.date ===
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
              restaurant: order.restaurant,
              delivery: {
                date: order.delivery.date,
              },
              hasReviewed: order.hasReviewed,
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
        // If upcoming weeks restaurants and customer
        // upcoming orders aren't fetched successfully
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

// Get all upcoming orders
router.get("/upcoming", authUser, async (req: Request, res: Response) => {
  // Check if there is an user
  if (req.user) {
    // Get data from req user
    const { role } = req.user;

    // If role is admin
    if (role === "ADMIN") {
      // Find the upcoming orders
      const response = await Order.find({ status: "PROCESSING" })
        .select("-__v -updatedAt")
        .sort({ "delivery.date": 1 });

      // If upcoming orders are found successfully
      if (response) {
        // Format the delivery date of each order
        const upcomingOrders = response.map((upcomingOrder) => ({
          ...upcomingOrder.toObject(),
          delivery: {
            ...upcomingOrder.delivery,
            date: convertDateToText(upcomingOrder.delivery.date),
          },
        }));

        // Send the data with response
        res.status(200).json(upcomingOrders);
      } else {
        // If upcoming orders aren't found successfully
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
          .select("-__v -updatedAt")
          .sort({ "delivery.date": -1 });

        // If orders are found successfully
        if (response) {
          // Convert date
          const deliveredOrders = response.map((deliveredOrder) => ({
            ...deliveredOrder.toObject(),
            delivery: {
              ...deliveredOrder.delivery,
              date: convertDateToText(deliveredOrder.delivery.date),
            },
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
// router.put(
//   "/:orderId/status",
//   authUser,
//   async (req: Request, res: Response) => {
//     // Destructure data from req
//     const { orderId } = req.params;

//     // Check if there is an user
//     if (req.user) {
//       // Destructure data from req
//       const { role } = req.user;

//       // If role is admin
//       if (role === "ADMIN") {
//         // Find the order and update the status
//         const response = await Order.findByIdAndUpdate(
//           orderId,
//           {
//             status: "DELIVERED",
//           },
//           {
//             returnDocument: "after",
//           }
//         )
//           .select("-__v -updatedAt")
//           .lean();

//         // If order is updated successfully
//         if (response) {
//           // Get customer name and email from the order
//           const { customer } = response;

//           // Send email to the customer
//           sendEmail(`${customer.firstName} ${customer.lastName}`, customer.email);

//           // Format delivery date date
//           const updatedOrder = {
//             ...response,
//             deliveryDate: convertDateToText(response.delivery.date),
//           };

//           // Send the update
//           res.status(200).json(updatedOrder);
//         } else {
//           // If order isn't updated successfully
//           res.status(500);
//           throw new Error("Something went wrong");
//         }
//       } else {
//         // If role isn't admin
//         res.status(401);
//         throw new Error("Not authorized");
//       }
//     } else {
//       // If there is no user
//       res.status(401);
//       throw new Error("Not authorized");
//     }
//   }
// );

export default router;
