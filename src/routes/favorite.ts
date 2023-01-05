import Restaurant from "../models/restaurant";
import Favorite from "../models/favorite";
import authUser from "../middleware/authUser";
import { IFavoritePayload } from "../types";
import { deleteFields } from "../utils";
import express, { Request, Response } from "express";

// Initialize router
const router = express.Router();

// Add a favorite
router.post(
  "/add-to-favorite",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { restaurantId, itemId }: IFavoritePayload = req.body;

    // If all the fields aren't provided
    if (!restaurantId || !itemId) {
      res.status(400);
      throw new Error("Please provide all the fields");
    }

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role, _id } = req.user;

      // If role is customer
      if (role === "CUSTOMER") {
        try {
          // Find the restaurant
          const restaurant = await Restaurant.findById(restaurantId)
            .lean()
            .orFail();

          // Find the item
          const item = restaurant.items.find(
            (item) => item._id?.toString() === itemId
          );

          if (item) {
            try {
              // Add item to favorite
              const favorite = await Favorite.create({
                customer: _id,
                item: {
                  _id: itemId,
                  name: item.name,
                  image: item.image || restaurant.logo,
                },
                restaurant: {
                  _id: restaurantId,
                  name: restaurant.name,
                },
              });

              // Delete fields
              deleteFields(favorite.toObject());

              // Send favorite with response
              res.status(201).json(favorite);
            } catch (err) {
              // If favorite isn't created
              throw err;
            }
          }
        } catch (err) {
          // If restaurant isn't found
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

// Remove a favorite
router.delete(
  "/:favoriteId/remove-from-favorite",
  authUser,
  async (req: Request, res: Response) => {
    // Destructure data from req
    const { favoriteId } = req.params;

    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      // If role is customer
      if (role === "CUSTOMER") {
        try {
          // Remove the favorite
          await Favorite.findByIdAndDelete({
            _id: favoriteId,
          });

          // Send data with response
          res.status(200).json({ message: "Favorite removed" });
        } catch (err) {
          // If favorite isn't removed successfully
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

// Get all favorite
router.get("/me", authUser, async (req: Request, res: Response) => {
  // Check if there is an user
  if (req.user) {
    // Destructure data from req
    const { role, _id } = req.user;

    // If role is customer
    if (role === "CUSTOMER") {
      try {
        // Find the favorites
        const favorites = await Favorite.find({
          customer: _id,
        }).select("-__v");

        // Send the data with response
        res.status(200).json(favorites);
      } catch (err) {
        // If favorites aren't fetched
        throw err;
      }
    } else {
      // If role isn't customer
      res.status(403);
      throw new Error("Not authorized");
    }
  }
});

export default router;
