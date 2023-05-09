import Order from "../models/order";
import Company from "../models/company";
import Restaurant from "../models/restaurant";
import authUser from "../middleware/authUser";
import express, { Request, Response } from "express";
import {
  now,
  sortByDate,
  resizeImage,
  deleteFields,
  checkActions,
  formatAddons,
  splitAddons,
  convertDateToMS,
  isCorrectAddonsFormat,
  getUpcomingRestaurants,
} from "../utils";
import { upload } from "../config/multer";
import { deleteImage, uploadImage } from "../config/s3";
import {
  IAddons,
  IItemPayload,
  IReviewPayload,
  IStatusChangePayload,
  IScheduleRestaurantPayload,
} from "../types";
import mail from "@sendgrid/mail";
import { orderCancelTemplate } from "../utils/emailTemplates";

// Initialize router
const router = express.Router();

// Get upcoming restaurants
router.get(
  "/upcoming-restaurants",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role, companies } = req.user;

      if (role === "CUSTOMER" && companies && companies.length > 0) {
        // Get upcoming week restaurants
        const upcomingRestaurants = await getUpcomingRestaurants(companies);

        // Send the data with response
        res.status(200).json(upcomingRestaurants);
      } else {
        // If role isn't customer
        console.log("Not authorized");

        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Get all scheduled restaurants
router.get(
  "/scheduled-restaurants",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        try {
          // Get the scheduled restaurants
          const response = await Restaurant.find({
            "schedules.date": {
              $gte: now,
            },
          }).select("-__v -updatedAt -createdAt -address -items -logo");

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
                convertDateToMS(scheduledRestaurant.date) >= now
            )
            .sort(sortByDate);

          // Return the scheduled restaurants with response
          res.status(200).json(scheduledRestaurants);
        } catch (err) {
          // If scheduled restaurants aren't found successfully
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't admin
        console.log("Not authorized");

        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Schedule a restaurant
router.post(
  "/schedule-restaurant",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        // Destructure data from req
        const { date, companyId, restaurantId }: IScheduleRestaurantPayload =
          req.body;

        // If full data isn't provided
        if (!date || !companyId || !restaurantId) {
          // Log error
          console.log("Please provide all the fields");

          res.status(400);
          throw new Error("Please fill all the fields");
        }

        // If provided date is a past date
        if (convertDateToMS(date) < now) {
          // Log error
          console.log("Cant' schedule on the provided date");

          res.status(400);
          throw new Error("Cant' schedule on the provided date");
        }

        try {
          // Find the restaurant and remove past dates
          const updatedRestaurant = await Restaurant.findOneAndUpdate(
            { _id: restaurantId },
            {
              $pull: {
                schedules: {
                  date: { $lt: now },
                },
              },
            },
            {
              returnDocument: "after",
            }
          )
            .select("-__v -updatedAt -createdAt -address -items -logo")
            .orFail();

          // Check if the restaurant is schedule
          // on the same date for the same company
          const isScheduled = updatedRestaurant.schedules.some(
            (schedule) =>
              companyId === schedule.company._id.toString() &&
              convertDateToMS(schedule.date) === convertDateToMS(date)
          );

          // If the restaurant is already scheduled
          if (isScheduled) {
            // Log error
            console.log("Already scheduled on the provided date");

            res.status(401);
            throw new Error("Already scheduled on the provided date");
          }

          try {
            // Find the company
            const company = await Company.findById(companyId).orFail();

            // Create the schedule
            const schedule = {
              date,
              status: "ACTIVE",
              company: {
                _id: company.id,
                name: company.name,
                shift: company.shift,
              },
            };

            // Add the schedule details to schedules
            updatedRestaurant.schedules.push(schedule);

            try {
              // Save the restaurant
              await updatedRestaurant.save();

              // Get added schedule
              const addedSchedule =
                updatedRestaurant.schedules[
                  updatedRestaurant.schedules.length - 1
                ];

              // Destructure the restaurant object
              const { schedules, ...rest } = updatedRestaurant.toObject();

              // Create restaurant with scheduled date and company details
              const scheduledRestaurant = {
                ...rest,
                ...schedule,
                scheduleId: addedSchedule._id,
              };

              // Delete fields
              deleteFields(scheduledRestaurant);

              // Send updated restaurant with response
              res.status(201).json(scheduledRestaurant);
            } catch (err) {
              // If restaurant isn't saved successfully
              console.log(err);

              throw err;
            }
          } catch (err) {
            // If company isn't found successfully
            console.log(err);

            throw err;
          }
        } catch (err) {
          // If past schedules aren't remove successfully
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't admin
        console.log("Not authorized");

        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Change schedule status
router.patch(
  "/:restaurantId/:scheduleId/change-schedule-status",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        // Destructure data from req
        const { restaurantId, scheduleId } = req.params;
        const { action }: IStatusChangePayload = req.body;

        // If all the fields aren't provide
        if (!action || !restaurantId || !scheduleId) {
          // Log error
          console.log("Please provide all the fields");

          res.status(400);
          throw new Error("Please provide all the fields");
        }

        // Check actions validity
        checkActions(["Activate", "Deactivate"], action, res);

        try {
          // Find and update the schedule status
          const updatedRestaurant = await Restaurant.findOneAndUpdate(
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
            .lean()
            .orFail();

          // If the schedule is updated successfully
          const updatedSchedules = updatedRestaurant.schedules.map(
            (schedule) => {
              // Create new schedule
              return {
                _id: updatedRestaurant._id,
                name: updatedRestaurant.name,
                scheduleId: schedule._id,
                date: schedule.date,
                status: schedule.status,
                company: schedule.company,
              };
            }
          );

          // Send the updated schedules with response
          res.status(201).json(updatedSchedules);
        } catch (err) {
          // If schedule status isn't changed successfully
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't admin or vendor
        console.log("Not authorized");

        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Remove a schedule
router.patch(
  "/:restaurantId/:scheduleId/remove-schedule",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        // Destructure data from req
        const { restaurantId, scheduleId } = req.params;

        // If all the fields aren't provide
        if (!restaurantId || !scheduleId) {
          // Log error
          console.log("Please provide all the fields");

          res.status(400);
          throw new Error("Please provide all the fields");
        }

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
            .lean()
            .orFail();

          // Find the removed schedule
          const removedSchedule = updatedRestaurant.schedules.find(
            (schedule) => schedule._id?.toString() === scheduleId
          );

          if (removedSchedule) {
            try {
              // Find the orders
              const orders = await Order.find({
                status: "PROCESSING",
                "delivery.date": removedSchedule.date,
                "restaurant._id": updatedRestaurant._id,
                "company._id": removedSchedule.company._id,
              });

              try {
                // Send cancellation email
                await Promise.all(
                  orders.map(
                    async (order) =>
                      await mail.send(orderCancelTemplate(order.toObject()))
                  )
                );

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
                  // If orders status aren't changed
                  console.log(err);

                  throw err;
                }
              } catch (err) {
                // If emails aren't sent
                console.log(err);

                throw err;
              }
            } catch (err) {
              // If orders aren't fetched
              console.log(err);

              throw err;
            }
          }
        } catch (err) {
          // If past schedules aren't removed
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't admin or vendor
        console.log("Not authorized");

        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Cerate an item
router.post(
  "/:restaurantId/add-item",
  authUser,
  upload,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN" || role === "VENDOR") {
        // Destructure data from req
        const { restaurantId } = req.params;
        const {
          name,
          tags,
          price,
          description,
          optionalAddons,
          requiredAddons,
          removableIngredients,
        }: IItemPayload = req.body;

        // If required fields aren't provided
        if (!restaurantId || !name || !tags || !price || !description) {
          // Log error
          console.log("Please provide all the fields");

          res.status(400);
          throw new Error("Please provide all the fields");
        }

        // Parse addons
        const parsedOptionalAddons: IAddons = JSON.parse(optionalAddons);
        const parsedRequiredAddons: IAddons = JSON.parse(requiredAddons);

        // Check optional addons format
        if (
          parsedOptionalAddons.addons &&
          !isCorrectAddonsFormat(parsedOptionalAddons)
        ) {
          // Log error
          console.log("Invalid optional addons format");

          res.status(400);
          throw new Error("Invalid optional addons format");
        }

        // Check required addons format
        if (
          parsedRequiredAddons.addons &&
          !isCorrectAddonsFormat(parsedRequiredAddons)
        ) {
          // Log error
          console.log("Invalid required addons format");

          res.status(400);
          throw new Error("Invalid required addons format");
        }

        // Create image URL
        let imageUrl;

        // If there is a file
        if (req.file) {
          // Destructure file data
          const { buffer, mimetype } = req.file;

          // Resize the image
          const modifiedBuffer = await resizeImage(res, buffer, 800, 500);

          // Upload image and get the URL
          imageUrl = await uploadImage(res, modifiedBuffer, mimetype);
        }

        // Formatted optional addons
        const formattedOptionalAddons =
          parsedOptionalAddons.addons && formatAddons(parsedOptionalAddons);

        // Formatted required addons
        const formattedRequiredAddons =
          parsedRequiredAddons.addons && formatAddons(parsedRequiredAddons);

        try {
          // Find the restaurant and add the item
          const updatedRestaurant = await Restaurant.findOneAndUpdate(
            { _id: restaurantId },
            {
              $push: {
                items: {
                  name,
                  tags,
                  price,
                  description,
                  image: imageUrl,
                  status: "ACTIVE",
                  removableIngredients,
                  optionalAddons:
                    formattedOptionalAddons || parsedOptionalAddons,
                  requiredAddons:
                    formattedRequiredAddons || parsedRequiredAddons,
                },
              },
            },
            {
              returnDocument: "after",
            }
          )
            .select("-__v -updatedAt")
            .lean()
            .orFail();

          // Return the updated restaurant
          res.status(201).json(updatedRestaurant);
        } catch (err) {
          // If item isn't added successfully
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't admin or vendor
        console.log("Not authorized");

        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Edit an item
router.patch(
  "/:restaurantId/:itemId/update-item-details",
  authUser,
  upload,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN" || role === "VENDOR") {
        // Destructure data from req
        const { restaurantId, itemId } = req.params;
        const {
          name,
          tags,
          price,
          image,
          description,
          optionalAddons,
          requiredAddons,
          removableIngredients,
        }: IItemPayload = req.body;

        // If required fields aren't provided
        if (
          !name ||
          !tags ||
          !price ||
          !itemId ||
          !description ||
          !restaurantId
        ) {
          // Log error
          console.log("Please provide all the fields");

          res.status(400);
          throw new Error("Please provide all the fields");
        }

        // Parse addons
        const parsedOptionalAddons: IAddons = JSON.parse(optionalAddons);
        const parsedRequiredAddons: IAddons = JSON.parse(requiredAddons);

        // Check optional addons format
        if (
          parsedOptionalAddons.addons &&
          !isCorrectAddonsFormat(parsedOptionalAddons)
        ) {
          // Log error
          console.log("Invalid optional addons format");

          res.status(400);
          throw new Error("Invalid optional addons format");
        }

        // Check required addons format
        if (
          parsedRequiredAddons.addons &&
          !isCorrectAddonsFormat(parsedRequiredAddons)
        ) {
          // Log error
          console.log("Invalid required addons format");

          res.status(400);
          throw new Error("Invalid required addons format");
        }

        // If a new file is provided and an image already exists
        if (req.file && image) {
          // Create name
          const name = image.split("/")[image.split("/").length - 1];

          // Delete image from s3
          await deleteImage(res, name);
        }

        // Create image URL
        let imageUrl = image;

        // If there is a file
        if (req.file) {
          // Destructure file data
          const { buffer, mimetype } = req.file;

          // Resize the image
          const modifiedBuffer = await resizeImage(res, buffer, 800, 500);

          // Upload image and get the URL
          imageUrl = await uploadImage(res, modifiedBuffer, mimetype);
        }

        // Formatted optional addons
        const formattedOptionalAddons =
          parsedOptionalAddons.addons && formatAddons(parsedOptionalAddons);

        // Formatted required addons
        const formattedRequiredAddons =
          parsedRequiredAddons.addons && formatAddons(parsedRequiredAddons);

        try {
          if (!imageUrl) {
            // Update the item
            const updatedRestaurant = await Restaurant.findOneAndUpdate(
              { _id: restaurantId, "items._id": itemId },
              {
                $set: {
                  "items.$.name": name,
                  "items.$.tags": tags,
                  "items.$.price": price,
                  "items.$.description": description,
                  "items.$.optionalAddons":
                    formattedOptionalAddons || parsedOptionalAddons,
                  "items.$.requiredAddons":
                    formattedRequiredAddons || parsedRequiredAddons,
                  "items.$.removableIngredients": removableIngredients,
                },
                $unset: {
                  "items.$.image": null,
                },
              },
              {
                returnDocument: "after",
              }
            )
              .lean()
              .orFail();

            // Delete fields
            deleteFields(updatedRestaurant, ["createdAt"]);

            // Return the updated restaurant with response
            res.status(201).json(updatedRestaurant);
          } else if (imageUrl) {
            // Update the item
            const updatedRestaurant = await Restaurant.findOneAndUpdate(
              { _id: restaurantId, "items._id": itemId },
              {
                $set: {
                  "items.$.name": name,
                  "items.$.tags": tags,
                  "items.$.price": price,
                  "items.$.image": imageUrl,
                  "items.$.description": description,
                  "items.$.optionalAddons":
                    formattedOptionalAddons || parsedOptionalAddons,
                  "items.$.requiredAddons":
                    formattedRequiredAddons || parsedRequiredAddons,
                  "items.$.removableIngredients": removableIngredients,
                },
              },
              {
                returnDocument: "after",
              }
            )
              .lean()
              .orFail();

            // Delete fields
            deleteFields(updatedRestaurant, ["createdAt"]);

            // Return the updated restaurant with response
            res.status(201).json(updatedRestaurant);
          }
        } catch (err) {
          // If item isn't updated successfully
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't admin or vendor
        console.log("Not authorized");

        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Change item status
router.patch(
  "/:restaurantId/:itemId/change-item-status",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === "ADMIN") {
        // Destructure data from req
        const { restaurantId, itemId } = req.params;
        const { action }: IStatusChangePayload = req.body;

        // If all the fields aren't provided
        if (!action || !restaurantId || !itemId) {
          // Log error
          console.log("Please provide all the fields");

          res.status(400);
          throw new Error("Please provide all the fields");
        }

        // Check actions validity
        checkActions(undefined, action, res);

        try {
          // Find the restaurant and update the item status
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
            .lean()
            .orFail();

          // Send the updated restaurant with response
          res.status(200).json(updatedRestaurant);
        } catch (err) {
          // If item status isn't updated successfully
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't admin or vendor
        console.log("Not authorized");

        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

// Add a review to an item
router.post(
  "/:restaurantId/:itemId/add-a-review",
  authUser,
  async (req: Request, res: Response) => {
    if (req.user) {
      // Destructure data
      const { role, _id } = req.user;

      if (role === "CUSTOMER") {
        // Destructure data from req
        const { restaurantId, itemId } = req.params;
        const { rating, comment, orderId }: IReviewPayload = req.body;

        // If rating or comment isn't provided
        if (!restaurantId || !itemId || !rating || !comment || !orderId) {
          // Log error
          console.log("Please provide all the fields");

          res.status(400);
          throw new Error("Please provide all the fields");
        }

        try {
          // Find and update the order
          const order = await Order.findOneAndUpdate(
            {
              _id: orderId,
              hasReviewed: false,
              status: "DELIVERED",
              "customer._id": _id,
            },
            { $set: { hasReviewed: true } },
            {
              returnDocument: "after",
            }
          ).orFail();

          try {
            // Find the restaurant and the review
            await Restaurant.findOneAndUpdate(
              {
                _id: restaurantId,
                "items._id": itemId,
                "items.reviews.customer": { $ne: _id },
              },
              {
                $push: {
                  "items.$.reviews": { customer: _id, rating, comment },
                },
              },
              { returnDocument: "after" }
            ).orFail();

            // Send the updated order with the response
            res.status(201).json(order);
          } catch (err) {
            // If review isn't added successfully
            console.log(err);

            throw err;
          }
        } catch (err) {
          // If order isn't found
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't customer
        console.log("Not authorized");

        res.status(403);
        throw new Error("Not authorized");
      }
    }
  }
);

export default router;
