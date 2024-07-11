module.exports = {
  async up(db, client) {
    await db
      .collection('restaurants')
      .updateMany({}, { $set: { isFeatured: false } });
  },

  async down(db, client) {
    await db
      .collection('restaurants')
      .updateMany({}, { $unset: { isFeatured: '' } });
  },
};
