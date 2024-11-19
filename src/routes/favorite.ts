import { Router } from 'express';
import Restaurant from '../models/restaurant';
import Favorite from '../models/favorite';
import auth from '../middleware/auth';
import { Types } from 'mongoose';
import { FavRestaurantItem } from '../types';
import { noItem, requiredFields, unAuthorized } from '../lib/messages';

const router = Router();

export interface FavoriteRestaurant {
  _id: Types.ObjectId;
  name: string;
  logo: string;
  items: FavRestaurantItem[];
}

// Get all favorite
router.get('/me', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  try {
    const response = await Favorite.find({
      customer: req.user._id,
    })
      .populate<{ restaurant: FavoriteRestaurant }>(
        'restaurant',
        '_id name logo items'
      )
      .select('-__v');

    let favorites = [];
    for (const favorite of response) {
      const item = favorite.restaurant.items.find(
        (item) => item._id.toString() === favorite.item._id.toString()
      );
      if (item) {
        favorites.push({
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
        });
      }
    }
    res.status(200).json(favorites);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Add a favorite
router.post('/add-to-favorite', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { _id } = req.user;
  const { restaurantId, itemId } = req.body;
  if (!restaurantId || !itemId) {
    console.log(requiredFields);
    res.status(400);
    throw new Error(requiredFields);
  }

  try {
    const restaurant = await Restaurant.findById(restaurantId).lean().orFail();
    const item = restaurant.items.find(
      (item) => item._id?.toString() === itemId
    );
    if (!item) {
      console.log(noItem);
      res.status(400);
      throw new Error(noItem);
    }

    const response = await Favorite.create({
      customer: _id,
      item: itemId,
      restaurant: restaurantId,
    });
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
    res.status(201).json(favorite);
  } catch (err) {
    console.log(err);
    throw err;
  }
});

// Remove a favorite
router.delete('/:favoriteId/remove-from-favorite', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    console.log(unAuthorized);
    res.status(403);
    throw new Error(unAuthorized);
  }

  const { favoriteId } = req.params;
  try {
    await Favorite.findByIdAndDelete({
      _id: favoriteId,
    });
    res.status(200).json({ message: 'Favorite removed' });
  } catch (err) {
    console.log(err);
    throw err;
  }
});

export default router;
