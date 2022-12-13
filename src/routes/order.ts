import { ICartItems, ICustomerOrder } from "./../types/index.d";
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

// Get customer's active orders
router.get("/me/active", authUser, async (req: Request, res: Response) => {
  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { _id, role } = req.user;

    // If role is customer
    if (role === "CUSTOMER") {
      // Find the active orders of the customer
      const customerActiveOrders = await Order.find({ "customer.id": _id })
        .where("status", "PROCESSING")
        .sort({ "delivery.date": 1 })
        .select("-__v -updatedAt -customer -delivery.address -company");

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
  const { cartItems }: ICartItems = req.body;

  // If items aren't provided
  if (!cartItems) {
    res.status(401);
    throw new Error("Please provide all the fields");
  }

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { _id, firstName, lastName, email, role, company } = req.user;

    // If role is customer
    if (role === "CUSTOMER" && company) {
      // Get upcoming week restaurants
      const upcomingWeekRestaurants = await getUpcomingWeekRestaurants();

      // Get customer active orders
      const customerActiveOrders = await Order.find({ "customer.id": _id })
        .where("status", "PROCESSING")
        .select("delivery item")
        .sort({ "delivery.date": 1 });

      // If upcoming weeks restaurants and active orders are fetched successfully
      if (upcomingWeekRestaurants && customerActiveOrders) {
        // Check if the provided items are valid
        const itemsAreValid = cartItems.every((cartItem) =>
          upcomingWeekRestaurants.some(
            (upcomingWeekRestaurant) =>
              upcomingWeekRestaurant._id.toString() === cartItem.restaurantId &&
              convertDateToMS(upcomingWeekRestaurant.scheduledOn) ===
                cartItem.deliveryDate &&
              upcomingWeekRestaurant.items.some(
                (item) => item._id?.toString() === cartItem._id
              )
          )
        );

        // If provided items are valid
        if (itemsAreValid) {
          // Create orders
          const orders = cartItems.map((cartItem) => {
            // Find the restaurant
            const restaurant = upcomingWeekRestaurants.find(
              (upcomingWeekRestaurant) =>
                upcomingWeekRestaurant._id.toString() === cartItem.restaurantId
            );

            // If restaurant is found
            if (restaurant) {
              // Find the item
              const item = restaurant.items.find(
                (item) => item._id?.toString() === cartItem._id
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
                    id: restaurant._id,
                    name: restaurant.name,
                  },
                  company: {
                    name: company.name,
                  },
                  delivery: {
                    date: cartItem.deliveryDate,
                    address: company.address,
                  },
                  status: "PROCESSING",
                  item: {
                    _id: item.id,
                    name: item.name,
                    tags: item.tags,
                    description: item.description,
                    quantity: cartItem.quantity,
                    total: unitPrice * cartItem.quantity,
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
              // Find the active orders those match the date
              const nextWeekDateActiveOrders = customerActiveOrders.filter(
                (customerActiveOrder) =>
                  convertDateToMS(customerActiveOrder.delivery.date) ===
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
        .select("-__v -updatedAt")
        .sort({ "delivery.date": 1 });

      // If active orders are found successfully
      if (response) {
        // Format the delivery date of each order
        const activeOrders = response.map((activeOrder) => ({
          ...activeOrder.toObject(),
          delivery: {
            ...activeOrder.delivery,
            date: convertDateToText(activeOrder.delivery.date),
          },
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
