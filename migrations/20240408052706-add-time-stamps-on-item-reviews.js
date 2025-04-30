module.exports = {
  async up(db) {
    const restaurants = await db.collection('restaurants').find().toArray();

    for (const restaurant of restaurants) {
      for (const item of restaurant.items) {
        for (const review of item.reviews) {
          review.createdAt = new Date();
          review.updatedAt = new Date();
        }
      }
      await db
        .collection('restaurants')
        .updateOne(
          { _id: restaurant._id },
          { $set: { items: restaurant.items } }
        );
    }
  },

  async down(db) {
    const restaurants = await db.collection('restaurants').find().toArray();

    for (const restaurant of restaurants) {
      for (const item of restaurant.items) {
        for (const review of item.reviews) {
          delete review.createdAt;
          delete review.updatedAt;
        }
      }
      await db
        .collection('restaurants')
        .updateOne(
          { _id: restaurant._id },
          { $set: { items: restaurant.items } }
        );
    }
  },
};
