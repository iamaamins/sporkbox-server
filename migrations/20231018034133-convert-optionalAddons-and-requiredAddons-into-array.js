module.exports = {
  async up(db) {
    try {
      // Get all restaurants
      const restaurants = await db.collection('restaurants').find().toArray();

      // Convert addons object to array
      const updatedRestaurants = restaurants.map((restaurant) => {
        const updatedItems = restaurant.items.map((item) => ({
          ...item,
          optionalAddons: [item.optionalAddons],
          requiredAddons: [item.requiredAddons],
        }));

        return {
          ...restaurant,
          items: updatedItems,
        };
      });

      // Update restaurants
      for (const updatedRestaurant of updatedRestaurants) {
        await db
          .collection('restaurants')
          .updateOne(
            { _id: updatedRestaurant._id },
            { $set: { items: updatedRestaurant.items } }
          );
      }
    } catch (err) {
      // Log error
      console.log(err);
    }
  },

  async down(db) {
    try {
      // Get all restaurants
      const restaurants = await db.collection('restaurants').find().toArray();

      // Convert addons array to object
      const updatedRestaurants = restaurants.map((restaurant) => {
        const updatedItems = restaurant.items.map((item) => ({
          ...item,
          optionalAddons: item.optionalAddons[0],
          requiredAddons: item.requiredAddons[0],
        }));

        return {
          ...restaurant,
          items: updatedItems,
        };
      });

      // Update restaurants
      for (const updatedRestaurant of updatedRestaurants) {
        await db
          .collection('restaurants')
          .updateOne(
            { _id: updatedRestaurant._id },
            { $set: { items: updatedRestaurant.items } }
          );
      }
    } catch (err) {
      // Log error
      console.log(err);
    }
  },
};
