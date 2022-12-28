import Order from "../models/order";
import Restaurant from "../models/restaurant";
import authUser from "../middleware/authUser";
import express, { Request, Response } from "express";
import {
  gte,
  sortByDate,
  deleteFields,
  convertDateToMS,
  getUpcomingWeekRestaurants,
} from "../utils";
import {
  IItemPayload,
  IReviewPayload,
  IScheduleRestaurantPayload,
} from "../types";
import Company from "../models/company";

// Initialize router
const router = express.Router();

// Get upcoming week restaurants
router.get("/upcoming", authUser, async (req: Request, res: Response) => {
  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { role, company } = req.user;

    // If role is customer
    if (role === "CUSTOMER" && company) {
      try {
        // Get upcoming week restaurants
        const upcomingWeekRestaurants = await getUpcomingWeekRestaurants(
          res,
          company.name
        );

        // Send the data with response
        res.status(200).json(upcomingWeekRestaurants);
      } catch (err) {
        // If upcoming week restaurants aren't fetched successfully
        res.status(500);
        throw new Error("Failed to fetch upcoming week restaurants");
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

// Get all scheduled restaurants
router.get("/scheduled", authUser, async (req: Request, res: Response) => {
  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    // If role is admin
    if (role === "ADMIN") {
      try {
        // Get the scheduled restaurants
        const response = await Restaurant.find({
          "schedules.date": {
            $gte: gte,
          },
        }).select("-__v -updatedAt -createdAt -address -items");

        // Create scheduled restaurants, then flat and sort
        const scheduledRestaurants = response
          .map((scheduledRestaurant) =>
            scheduledRestaurant.schedules.map((schedule) => {
              // Destructure scheduled restaurant
              const { schedules, ...rest } = scheduledRestaurant.toObject();

              // Create new restaurant object
              return {
                ...rest,
                date: schedule.date,
                company: schedule.company,
              };
            })
          )
          .flat(2)
          .filter(
            (scheduledRestaurant) =>
              convertDateToMS(scheduledRestaurant.date) >= gte
          )
          .sort(sortByDate);

        // Return the scheduled restaurants with response
        res.status(200).json(scheduledRestaurants);
      } catch (err) {
        // If scheduled restaurants aren't found successfully
        res.status(500);
        throw new Error("Failed to fetch scheduled restaurants");
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

// Schedule a restaurant
router.put("/schedule", authUser, async (req: Request, res: Response) => {
  // Destructure data from req
  const { date, companyId, restaurantId }: IScheduleRestaurantPayload =
    req.body;

  // If full data isn't provided
  if (!date || !companyId || !restaurantId) {
    res.status(400);
    throw new Error("Please fill all the fields");
  }

  // If provided date is a past date
  if (convertDateToMS(date) < gte) {
    res.status(400);
    throw new Error("Cant' schedule a restaurant in the past");
  }

  // Get the day from provided date
  const day = new Date(date).toUTCString().split(",")[0];

  // Restrict scheduling on saturday and sunday
  if (day === "Sat" || day === "Sun") {
    res.status(400);
    throw new Error(
      `Can't schedule a restaurant on ${day === "Sat" ? "Saturday" : "Sunday"}`
    );
  }

  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { role } = req.user;

    // If role is admin
    if (role === "ADMIN") {
      try {
        // Find the restaurant and remove past dates
        const updatedRestaurant = await Restaurant.findByIdAndUpdate(
          restaurantId,
          {
            $pull: {
              schedules: {
                date: { $lt: Date.now() },
              },
            },
          },
          {
            returnDocument: "after",
          }
        ).select("-__v -updatedAt -createdAt -address -items");

        // If restaurant is found
        if (updatedRestaurant) {
          // Check if the restaurant is schedule
          // on the same date for the same company
          const isScheduled = updatedRestaurant.schedules.some(
            (schedule) =>
              companyId === schedule.company._id.toString() &&
              convertDateToMS(schedule.date) === convertDateToMS(date)
          );

          // If the restaurant is already scheduled
          if (isScheduled) {
            res.status(401);
            throw new Error("Already scheduled on the provided date");
          }

          // Find the company and create the schedule
          try {
            // Find the company
            const company = await Company.findById(companyId);

            // If company is found successfully
            if (company) {
              // Create the schedule
              const schedule = {
                date,
                company: { _id: company.id, name: company.name },
              };

              // Add the schedule details to schedules
              updatedRestaurant.schedules.push(schedule);

              // Save the restaurant and send the data with response
              try {
                // Save the restaurant
                await updatedRestaurant.save();

                // Destructure the restaurant object
                const { schedules, ...rest } = updatedRestaurant.toObject();

                // Create restaurant with scheduled date and company details
                const scheduledRestaurant = {
                  ...rest,
                  ...schedule,
                };

                // Delete fields
                deleteFields(scheduledRestaurant);

                // Send updated restaurant with response
                res.status(201).json(scheduledRestaurant);
              } catch (err) {
                // If restaurant isn't saved successfully
                res.status(500);
                throw new Error("Failed to save new schedule");
              }
            }
          } catch (err) {
            // If company isn't found successfully
            res.status(500);
            throw new Error("Failed to fetch company");
          }
        }
      } catch (err) {
        // If scheduled restaurants aren't found successfully
        res.status(500);
        throw new Error("Failed to remove past dates");
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

// Add an item to a restaurant
router.post(
  "/:restaurantId/add-item",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { restaurantId } = req.params;
    const { name, description, tags, price }: IItemPayload = req.body;

    // If restaurant id, name, description, tags, price aren't provided
    if (!name || !description || !tags || !price) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // If there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If the role is either admin or vendor
      if (role === "ADMIN" || role === "VENDOR") {
        // Find the restaurant and add the item
        try {
          const updatedRestaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            {
              $push: { items: { name, description, tags, price } },
            },
            {
              returnDocument: "after",
            }
          )
            .select("-__v -updatedAt")
            .lean();

          // Return the updated restaurant
          res.status(201).json(updatedRestaurant);
        } catch (err) {
          // If item isn't successfully added
          res.status(500);
          throw new Error("Failed to add item");
        }
      } else {
        // If role isn't admin or vendor
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

// Edit an item
router.put(
  "/:restaurantId/:itemId/update",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { restaurantId, itemId } = req.params;
    const { name, description, tags, price }: IItemPayload = req.body;

    // If restaurant id, name, description, tags, price aren't provided
    if (!itemId || !name || !description || !tags || !price) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // If there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If the role is either admin or vendor
      if (role === "ADMIN" || role === "VENDOR") {
        try {
          // Find and update the item
          const updatedRestaurant = await Restaurant.findOneAndUpdate(
            { _id: restaurantId, "items._id": itemId },
            {
              $set: {
                "items.$.name": name,
                "items.$.tags": tags,
                "items.$.price": price,
                "items.$.description": description,
              },
            },
            {
              returnDocument: "after",
            }
          ).lean();

          // If item is updated successfully
          if (updatedRestaurant) {
            // Delete fields
            deleteFields(updatedRestaurant, ["createdAt"]);

            // Return the updated restaurant with response
            res.status(201).json(updatedRestaurant);
          }
        } catch (err) {
          // If item isn't updated successfully
          res.status(401);
          throw new Error("Failed to update item");
        }
      } else {
        // If role isn't admin or vendor
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

// Delete an item
router.delete(
  "/:restaurantId/:itemId/delete-item",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { restaurantId, itemId } = req.params;

    // If there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin or vendor
      if (role === "ADMIN" || role === "VENDOR") {
        try {
          // Find the restaurant and delete the item
          const updatedRestaurant = await Restaurant.findByIdAndUpdate(
            { _id: restaurantId },
            {
              $pull: {
                items: { _id: itemId },
              },
            },
            {
              returnDocument: "after",
            }
          ).lean();

          // Send the updated restaurant with response
          res.status(200).json(updatedRestaurant);
        } catch (err) {
          // If the item isn't removed successfully
          res.status(500);
          throw new Error("Failed to delete the item");
        }
      } else {
        // If role isn't admin or vendor
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

// Add a review to an item
router.post(
  "/:restaurantId/:itemId",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { restaurantId, itemId } = req.params;
    const { rating, comment, orderId }: IReviewPayload = req.body;

    // If rating or comment isn't provided
    if (!rating || !comment) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // If there is an user in the req
    if (req.user) {
      // Destructure data
      const { role, _id } = req.user;

      // If role is customer
      if (role === "CUSTOMER") {
        try {
          // Find the order
          const order = await Order.findById({ customerId: _id })
            .where("status", "DELIVERED")
            .where("_id", orderId);

          // If order is found successfully
          if (order) {
            try {
              // Find the restaurant
              const restaurant = await Restaurant.findById(restaurantId);

              // If restaurant is found successfully
              if (restaurant) {
                // Find the item
                const item = restaurant.items.find(
                  (item) => item.id === itemId
                );

                // If no item is found
                if (!item) {
                  res.status(401);
                  throw new Error("Item doesn't exists");
                }

                // Check if customer has reviewed the item already
                const hasReviewed = item.reviews.some(
                  (review) => review.customer.toString() === _id.toString()
                );

                // If customer has reviewed the item already
                if (hasReviewed) {
                  res.status(400);
                  throw new Error("Already reviewed this item!");
                }

                // Add the review
                item.reviews.push({ customer: _id, rating, comment });

                try {
                  // Save the restaurant
                  await restaurant.save();

                  // Update the order
                  order.hasReviewed = true;

                  try {
                    // Save the order
                    await order.save();

                    // Return the updated order item
                    res.status(201).json(order);
                  } catch (err) {
                    // If order isn't saved successfully
                    res.status(500);
                    throw new Error("Failed to save order");
                  }
                } catch (err) {
                  // If restaurant isn't saved successfully
                  res.status(500);
                  throw new Error("Failed to save restaurant");
                }
              }
            } catch (err) {
              // If restaurant isn't found
              res.status(500);
              throw new Error("Failed to fetch restaurant");
            }
          }
        } catch (err) {
          // If order isn't found
          res.status(500);
          throw new Error("Failed to fetch order");
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

export default router;
