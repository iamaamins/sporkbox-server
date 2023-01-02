import Order from "../models/order";
import Restaurant from "../models/restaurant";
import authUser from "../middleware/authUser";
import express, { Request, Response } from "express";
import {
  gte,
  upload,
  sortByDate,
  deleteFields,
  convertDateToMS,
  getUpcomingWeekRestaurants,
  checkActions,
} from "../utils";
import { uploadImage } from "../config/s3";
import {
  IItemPayload,
  IReviewPayload,
  IScheduleRestaurantPayload,
} from "../types";
import Company from "../models/company";

// Initialize router
const router = express.Router();

// Get upcoming week restaurants
router.get(
  "/upcoming-restaurants",
  authUser,
  async (req: Request, res: Response) => {
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
  }
);

// Get all scheduled restaurants
router.get(
  "/scheduled-restaurants",
  authUser,
  async (req: Request, res: Response) => {
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

                // Create new scheduled restaurant
                return {
                  ...rest,
                  scheduleId: schedule._id,
                  date: schedule.date,
                  status: schedule.status,
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
  }
);

// Schedule a restaurant
router.post(
  "/schedule-restaurant",
  authUser,
  async (req: Request, res: Response) => {
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
        `Can't schedule a restaurant on ${
          day === "Sat" ? "Saturday" : "Sunday"
        }`
      );
    }

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin
      if (role === "ADMIN") {
        // Find the restaurant and remove past dates
        const updatedRestaurant = await Restaurant.findOneAndUpdate(
          { _id: restaurantId },
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

          try {
            // Find the company
            const company = await Company.findById(companyId);

            // If company is found successfully
            if (company) {
              // Create the schedule
              const schedule = {
                date,
                status: "ACTIVE",
                company: { _id: company.id, name: company.name },
              };

              // Add the schedule details to schedules
              updatedRestaurant.schedules.push(schedule);

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

// Change schedule status
router.patch(
  "/:restaurantId/:scheduleId/change-schedule-status",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { action } = req.body;
    const { restaurantId, scheduleId } = req.params;

    // If all the fields aren't provide
    if (!action || !restaurantId || !scheduleId) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // Check actions validity
    checkActions(["Activate", "Deactivate"], action, res);

    // If there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin or vendor
      if (role === "ADMIN") {
        try {
          // Find and update the item
          const response = await Restaurant.findOneAndUpdate(
            { _id: restaurantId, "schedules._id": scheduleId },
            {
              $set: {
                "schedules.$.status":
                  action === "Deactivate" ? "INACTIVE" : "ACTIVE",
              },
            },
            {
              returnDocument: "after",
            }
          )
            .select("-__v -updatedAt -createdAt -address -items")
            .lean();

          // If the schedule is updated successfully
          if (response) {
            const updatedSchedules = response.schedules.map((schedule) => {
              // Create new schedule
              return {
                _id: response._id,
                name: response.name,
                scheduleId: schedule._id,
                date: schedule.date,
                status: schedule.status,
                company: schedule.company,
              };
            });

            // Send the updated schedules with response
            res.status(201).json(updatedSchedules);
          }
        } catch (err) {
          // If item status isn't updated successfully
          res.status(500);
          throw new Error("Failed to update schedule status");
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

// Add an item to a restaurant
router.post(
  "/:restaurantId/add-item",
  authUser,
  upload.single("image"),
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
        // Create image URL
        let image;

        // If there is a file
        if (req.file) {
          // Destructure file data
          const { buffer, mimetype } = req.file;

          // Upload image and get the URL
          image = await uploadImage(res, buffer, mimetype);
        }

        try {
          // Find the restaurant and add the item
          const updatedRestaurant = await Restaurant.findByIdAndUpdate(
            restaurantId,
            {
              $push: {
                items: {
                  name,
                  tags,
                  price,
                  image,
                  description,
                  status: "ACTIVE",
                },
              },
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
router.patch(
  "/:restaurantId/:itemId/update-item-details",
  authUser,
  upload.single("image"),
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
        // Create image URL
        let image;

        // If there is a file
        if (req.file) {
          // Destructure file data
          const { buffer, mimetype } = req.file;

          // Upload image and get the URL
          image = await uploadImage(res, buffer, mimetype);
        }

        try {
          // Find and update the item
          const updatedRestaurant = await Restaurant.findOneAndUpdate(
            { _id: restaurantId, "items._id": itemId },
            {
              $set: {
                "items.$.name": name,
                "items.$.tags": tags,
                "items.$.price": price,
                "items.$.image": image,
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

// Change item status
router.patch(
  "/:restaurantId/:itemId/change-item-status",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { action } = req.body;
    const { restaurantId, itemId } = req.params;

    // If all the fields aren't provided
    if (!action || !restaurantId || !itemId) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // Check actions validity
    checkActions(undefined, action, res);

    // If there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin or vendor
      if (role === "ADMIN") {
        try {
          // Find and update the item
          const updatedRestaurant = await Restaurant.findOneAndUpdate(
            { _id: restaurantId, "items._id": itemId },
            {
              $set: {
                "items.$.status": action === "Archive" ? "ARCHIVED" : "ACTIVE",
              },
            },
            {
              returnDocument: "after",
            }
          )
            .select("-__v -updatedAt")
            .lean();

          // Send the updated restaurant with response
          res.status(200).json(updatedRestaurant);
        } catch (err) {
          // If item status isn't updated successfully
          res.status(500);
          throw new Error("Failed to update item status");
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
  "/:restaurantId/:itemId/add-review",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { restaurantId, itemId } = req.params;
    const { rating, comment, orderId }: IReviewPayload = req.body;

    // If rating or comment isn't provided
    if (!restaurantId || !itemId || !rating || !comment || !orderId) {
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
          const order = await Order.findById(orderId).where(
            "status",
            "DELIVERED"
          );

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

// Remove a schedule
router.patch(
  "/:restaurantId/:scheduleId/remove-schedule",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { restaurantId, scheduleId } = req.params;

    // If all the fields aren't provide
    if (!restaurantId || !scheduleId) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // If there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin or vendor
      if (role === "ADMIN") {
        try {
          // Find the restaurant and remove the schedule
          const updatedRestaurant = await Restaurant.findOneAndUpdate(
            { _id: restaurantId },
            {
              $pull: {
                schedules: { _id: scheduleId },
              },
            }
          )
            .select("-__v -updatedAt -createdAt -address -items")
            .lean();

          if (updatedRestaurant) {
            // Find the removed schedule
            const removedSchedule = updatedRestaurant.schedules.find(
              (schedule) => schedule._id?.toString() === scheduleId
            );

            if (removedSchedule) {
              try {
                // Change orders status to archive
                await Order.updateMany(
                  {
                    status: "PROCESSING",
                    "restaurant._id": updatedRestaurant._id,
                    "delivery.date": removedSchedule.date,
                    "company._id": removedSchedule.company._id,
                  },
                  {
                    $set: { status: "ARCHIVED" },
                  }
                );

                // Send response
                res
                  .status(201)
                  .json("Schedule and orders removed successfully");
              } catch (err) {
                // If orders status aren't successfully
                res.status(500);
                throw new Error("Failed to update orders status");
              }
            }
          }
        } catch (err) {
          // If schedule isn't removed successfully
          res.status(500);
          throw new Error("Failed to remove the schedule");
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

export default router;
