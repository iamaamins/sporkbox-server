const express = require("express");
const Favorite = require("../models/favorite");
const authUser = require("../middleware/authUser");

// Initialize router
const router = express.Router();

// Add a favorite
router.post("/add", authUser, async (req, res) => {
  // Destructure data from req
  const { role, _id } = req.user;
  const { restaurantId, restaurantName, itemId, itemName } = req.body;

  // If all the fields aren't provided
  if (!restaurantId || !restaurantName || !itemId || !itemName) {
    res.status(400);
    throw new Error("Please provide all the fields");
  }

  // If role is customer
  if (role === "CUSTOMER") {
    // Add favorite to db
    const favorite = await Favorite.create({
      itemId,
      itemName,
      restaurantId,
      restaurantName,
      customerId: _id,
    });

    // If favorite is created successfully
    if (favorite) {
      // Send data with response
      res.status(201).json(favorite);
    } else {
      // If favorite isn't created successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If role isn't customer
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Remove a favorite
router.delete("/:favoriteId/remove", authUser, async (req, res) => {
  // Destructure data from req
  const { role } = req.user;
  const { favoriteId } = req.params;

  // If role is customer
  if (role === "CUSTOMER") {
    // Delete the favorite
    const deletedFavorite = await Favorite.findByIdAndDelete({
      _id: favoriteId,
    });

    // If favorite is deleted successfully
    if (deletedFavorite) {
      res.status(200).json({ message: "Successfully deleted" });
    } else {
      // If favorite isn't deleted successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If role isn't customer
    res.status(401);
    throw new Error("Not authorized");
  }
});

// Get all favorite
router.get("/me", authUser, async (req, res) => {
  // Destructure data from req
  const { role, _id } = req.user;

  // If role is customer
  if (role === "CUSTOMER") {
    // Find the favorites
    const favorites = await Favorite.find({ customerId: _id });

    // If favorites are found successfully
    if (favorites) {
      // Send the data with response
      res.status(200).json(favorites);
    } else {
      // If favorites aren't found successfully
      res.status(500);
      throw new Error("Something went wrong");
    }
  } else {
    // If role isn't customer
    res.status(401);
    throw new Error("Not authorized");
  }
});

module.exports = router;
