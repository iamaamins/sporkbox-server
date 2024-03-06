import { Router } from 'express';
import Restaurant from '../models/restaurant';
import Favorite from '../models/favorite';
import authUser from '../middleware/auth';
import { Types } from 'mongoose';
import { FavRestaurantItem } from '../types';

// Types
interface FavoritePayload {
  itemId: string;
  restaurantId: string;
}

export interface FavoriteRestaurant {
  _id: Types.ObjectId;
  name: string;
  logo: string;
  items: FavRestaurantItem[];
}

// Initialize router
const router = Router();

// Add a favorite
router.post('/add-to-favorite', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data from req
    const { role, _id } = req.user;

    if (role === 'CUSTOMER') {
      // Destructure data from req
      const { restaurantId, itemId }: FavoritePayload = req.body;

      // If all the fields aren't provided
      if (!restaurantId || !itemId) {
        // Log error
        console.log('Please provide all the fields');

        res.status(400);
        throw new Error('Please provide all the fields');
      }

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
            const response = await Favorite.create({
              customer: _id,
              item: itemId,
              restaurant: restaurantId,
            });

            // Create favorite
            const favorite = {
              _id: response._id,
              item: {
                _id: item._id,
                name: item.name,
                image: item.image || restaurant.logo,
              },
              customer: response.customer,
              restaurant: {
                _id: restaurant._id,
                name: restaurant.name,
              },
            };

            // Send data with response
            res.status(201).json(favorite);
          } catch (err) {
            // If item isn't added to favorite
            console.log(err);

            throw err;
          }
        } else {
          // If no item is found
          console.log('No item found');

          res.status(400);
          throw new Error('No item found');
        }
      } catch (err) {
        // If restaurant isn't found
        console.log(err);

        throw err;
      }
    } else {
      // If role isn't customer
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

// Remove a favorite
router.delete(
  '/:favoriteId/remove-from-favorite',
  authUser,
  async (req, res) => {
    // Check if there is an user
    if (req.user) {
      // Destructure data from req
      const { role } = req.user;

      if (role === 'CUSTOMER') {
        // Destructure data from req
        const { favoriteId } = req.params;

        // If all the fields aren't provided
        if (!favoriteId) {
          // Log error
          console.log('Please provide all the fields');

          res.status(400);
          throw new Error('Please provide all the fields');
        }

        try {
          // Remove the favorite
          await Favorite.findByIdAndDelete({
            _id: favoriteId,
          });

          // Send data with response
          res.status(200).json({ message: 'Favorite removed' });
        } catch (err) {
          // If favorite isn't removed successfully
          console.log(err);

          throw err;
        }
      } else {
        // If role isn't customer
        console.log('Not authorized');

        res.status(403);
        throw new Error('Not authorized');
      }
    }
  }
);

// Get all favorite
router.get('/me', authUser, async (req, res) => {
  if (req.user) {
    // Destructure data from req
    const { role, _id } = req.user;

    if (role === 'CUSTOMER') {
      try {
        // Find the favorites
        const response = await Favorite.find({
          customer: _id,
        })
          .populate<{ restaurant: FavoriteRestaurant }>(
            'restaurant',
            '_id name logo items'
          )
          .select('-__v');

        // Create favorites
        const favorites = response.map((favorite) => {
          // Get the item
          const item = favorite.restaurant.items.find(
            (item) => item._id.toString() === favorite.item._id.toString()
          );

          // If there is an item
          if (item) {
            return {
              _id: favorite._id,
              item: {
                _id: item._id,
                name: item.name,
                image: item.image || favorite.restaurant.logo,
              },
              customer: favorite.customer,
              restaurant: {
                _id: favorite.restaurant._id,
                name: favorite.restaurant.name,
              },
            };
          }
        });

        // Send the data with response
        res.status(200).json(favorites);
      } catch (err) {
        // If favorites aren't fetched
        console.log(err);

        throw err;
      }
    } else {
      // If role isn't customer
      console.log('Not authorized');

      res.status(403);
      throw new Error('Not authorized');
    }
  }
});

export default router;
