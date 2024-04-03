module.exports = {
  async up(db) {
    try {
      const restaurants = await db.collection('restaurants').find().toArray();

      for (const restaurant of restaurants) {
        for (const item of restaurant.items) {
          const numberOfReviews = item.reviews.length;

          if (numberOfReviews > 0) {
            const totalRating = item.reviews.reduce(
              (acc, curr) => acc + curr.rating,
              0
            );
            const averageRating = (totalRating / numberOfReviews).toFixed(2);
            item.averageRating = +averageRating;
          }
        }
        await db
          .collection('restaurants')
          .updateOne(
            { _id: restaurant._id },
            { $set: { items: restaurant.items } }
          );
      }
    } catch (err) {
      console.log(err);
    }
  },

  async down(db) {
    try {
      const restaurants = await db.collection('restaurants').find().toArray();

      for (const restaurant of restaurants) {
        for (const item of restaurant.items) {
          delete item.averageRating;
        }
        await db
          .collection('restaurants')
          .updateOne(
            { _id: restaurant._id },
            { $set: { items: restaurant.items } }
          );
      }
    } catch (err) {
      console.log(err);
    }
  },
};
