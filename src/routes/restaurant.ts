import express, { Request, Response } from "express";
import Restaurant from "../models/restaurant";
import authUser from "../middleware/authUser";
import { gte, lt, sortByDate, convertDateToMS } from "../utils";

// Initialize router
const router = express.Router();

// Get upcoming week restaurants
router.get("/upcoming-week", async (req: Request, res: Response) => {
  // Get the scheduled restaurants
  const response = await Restaurant.find({
    schedules: {
      $gte: gte,
      $lt: lt,
    },
  }).select("-__v -updatedAt -createdAt -address");

  // If restaurants are found successfully
  if (response) {
    // Create scheduled restaurants, then flat and sort
    const upcomingWeekRestaurants = response
      .map((upcomingWeekRestaurant) => ({
        ...upcomingWeekRestaurant.toObject(),
        schedules: upcomingWeekRestaurant.schedules.filter(
          (schedule) => schedule >= gte && schedule < lt
        ),
      }))
      .map((upcomingWeekRestaurant) =>
        upcomingWeekRestaurant.schedules.map((schedule) => {
          // Destructure scheduled restaurant
          const { schedules, ...rest } = upcomingWeekRestaurant;

          // Create new restaurant object
          return {
            ...rest,
            scheduledOn: schedule,
          };
        })
      )
      .flat(2)
      .sort(sortByDate);

    // Return the scheduled restaurants with response
    res.status(200).json(upcomingWeekRestaurants);
  } else {
    res.status(500);
    throw new Error("Something went wrong");
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
      // Get the scheduled restaurants
      const response = await Restaurant.find({
        schedules: {
          $gte: gte,
        },
      }).select("-__v -updatedAt -createdAt -address -items");

      // If restaurants are found successfully
      if (response) {
        // Create scheduled restaurants, then flat and sort
        const scheduledRestaurants = response
          .map((scheduledRestaurant) =>
            scheduledRestaurant.schedules.map((schedule) => {
              // Destructure scheduled restaurant
              const { schedules, ...rest } = scheduledRestaurant.toObject();

              // Create new restaurant object
              return {
                ...rest,
                scheduledOn: schedule,
              };
            })
          )
          .flat(2)
          .filter(
            (scheduledRestaurant) =>
              convertDateToMS(scheduledRestaurant.scheduledOn as string) >= gte
          )
          .sort(sortByDate);

        // Return the scheduled restaurants with response
        res.status(200).json(scheduledRestaurants);
      } else {
        res.status(500);
        throw new Error("Something went wrong");
      }
    } else {
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
router.put(
  "/schedule/:restaurantId",
  authUser,
  async (req: Request, res: Response) => {
    const { date } = req.body;
    const { restaurantId } = req.params;

    // If date isn't provided
    if (!date) {
      res.status(400);
      throw new Error("Please fill all the fields");
    }

    // If provided date is a past date
    if (convertDateToMS(date) < Date.now()) {
      res.status(400);
      throw new Error("Cant' schedule a restaurant in the past");
    }

    // Get the day from provided date
    const day = new Date(date).toDateString().split(" ")[0];

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
        const restaurant = await Restaurant.findByIdAndUpdate(
          restaurantId,
          {
            $pull: {
              schedules: {
                $lt: Date.now(),
              },
            },
          },
          {
            returnDocument: "after",
          }
        ).select("-__v -updatedAt -createdAt -address");

        // If restaurant is found
        if (restaurant) {
          // Check if the restaurant is schedule on the same date
          const isScheduled = restaurant.schedules.find(
            (schedule) =>
              convertDateToMS(schedule as string) === convertDateToMS(date)
          );

          // If the restaurant is already scheduled
          if (isScheduled) {
            res.status(401);
            throw new Error("Already scheduled on the provided date");
          }

          // Add the date to schedules
          restaurant.schedules.push(date);

          // Save the restaurant
          await restaurant.save();

          // Create scheduled restaurant
          const { __v, schedules, ...rest } = restaurant;

          // Create restaurant with scheduled date
          const scheduledRestaurant = { ...rest, scheduledOn: date };

          // Send updated restaurant with response
          res.status(201).json(scheduledRestaurant);
        } else {
          res.status(500);
          throw new Error("Something went wrong");
        }
      } else {
        res.status(401);
        throw new Error("Something went wrong");
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
  async (req: Request, res: Response) => {
    const { restaurantId } = req.params;
    const { name, description, tags, price } = req.body;

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

        // If item is successfully added to db
        if (updatedRestaurant) {
          // Return the updated restaurant
          res.status(201).json(updatedRestaurant);
        } else {
          // If item isn't successfully add to db
          res.status(500);
          throw new Error("Something went wrong!");
        }
      } else {
        // Return not authorized if role isn't admin or vendor
        res.status(401);
        throw new Error("Not authorized");
      }
    } else {
      res.status(401);
      throw new Error("Not authorized");
    }
  }
);

// Edit an item
router.put(
  "/:restaurantId/itemId/edit-item",
  authUser,
  (req: Request, res: Response) => {
    res.json("Hello");
  }
);

// Delete an item
router.delete(
  "/:restaurantId/:itemId/delete-item",
  authUser,
  async (req: Request, res: Response) => {
    const { restaurantId, itemId } = req.params;

    // If there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is admin or vendor
      if (role === "ADMIN" || role === "VENDOR") {
        // Find the restaurant and remove the item
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

        // If the item is removed successfully
        if (updatedRestaurant) {
          // Send the updated restaurant with response
          res.status(200).json(updatedRestaurant);
        } else {
          // If the item isn't removed successfully
          res.status(500);
          throw new Error("Something went wrong");
        }
      } else {
        // If role isn't admin or vendor
        res.status(401);
        throw new Error("Not authorized");
      }
    } else {
      res.status(401);
      throw new Error("Not authorized");
    }
  }
);

export default router;
