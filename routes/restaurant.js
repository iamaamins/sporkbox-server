const express = require("express");
const Restaurant = require("../models/restaurant");
const authUser = require("../middleware/authUser");

// Initialize router
const router = express.Router();

// Add an item to a restaurant
router.post("/:restaurantId/add-item", authUser, async (req, res) => {
  const { role } = req.user;
  const { restaurantId } = req.params;
  const { name, description, tags, price } = req.body;

  // If restaurant id, name, description, tags, price aren't provided
  if (!name || !description || !tags || !price) {
    res.status(400);
    throw new Error("Please provide all the fields");
  }

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
});

// Edit an item
router.put("/:restaurantId/itemId/edit-item", authUser, (req, res) => {
  res.json("Hello");
});

// Delete an item
router.delete(
  "/:restaurantId/:itemId/delete-item",
  authUser,
  async (req, res) => {
    const { role } = req.user;
    const { restaurantId, itemId } = req.params;

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
  }
);

module.exports = router;
