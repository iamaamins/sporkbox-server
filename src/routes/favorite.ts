import { IFavoritePayload, IFavoriteRestaurant } from "../types";
import Favorite from "../models/favorite";
import authUser from "../middleware/authUser";
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
          // Add item to favorite
          const response = await Favorite.create({
            customerId: _id,
            itemId: itemId,
            restaurant: restaurantId,
          });

          try {
            // Populate restaurant
            const favoriteWithRestaurant = await response.populate<{
              restaurant: IFavoriteRestaurant;
            }>("restaurant", "_id name items");

            // Find the item
            const item = favoriteWithRestaurant.restaurant.items.find(
              (item) =>
                item._id.toString() === favoriteWithRestaurant.itemId.toString()
            );

            // If item is found
            if (item) {
              // Create favorite
              const favorite = {
                _id: favoriteWithRestaurant._id,
                itemId: item._id,
                itemName: item.name,
                customerId: favoriteWithRestaurant.customerId,
                restaurantId: favoriteWithRestaurant.restaurant._id,
                restaurantName: favoriteWithRestaurant.restaurant.name,
              };

              // Send data with response
              res.status(201).json(favorite);
            }
          } catch (err) {
            // If restaurant isn't populated
            throw err;
          }
        } catch (err) {
          // If item isn't added to favorite
          throw err;
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
        const response = await Favorite.find({
          customerId: _id,
        }).populate<{ restaurant: IFavoriteRestaurant }>(
          "restaurant",
          "_id name items"
        );

        // Create favorites
        const favorites = response.map((favorite) => {
          // Get the item
          const item = favorite.restaurant.items.find(
            (item) => item._id.toString() === favorite.itemId.toString()
          );

          // If there is an item
          if (item) {
            return {
              _id: favorite._id,
              itemId: item._id,
              itemName: item.name,
              customerId: favorite.customerId,
              restaurantId: favorite.restaurant._id,
              restaurantName: favorite.restaurant.name,
            };
          }
        });

        // Send the data with response
        res.status(200).json(favorites);
      } catch (err) {
        // If favorites aren't fetched
        throw err;
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

export default router;
