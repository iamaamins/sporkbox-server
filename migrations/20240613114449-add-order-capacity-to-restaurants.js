module.exports = {
  async up(db, client) {
    const restaurants = await db
      .collection('restaurants')
      .updateMany({}, { $set: { orderCapacity: Infinity } });
  },

  async down(db, client) {
    const restaurants = await db
      .collection('restaurants')
      .updateMany({}, { $unset: { orderCapacity: '' } });
  },
};
