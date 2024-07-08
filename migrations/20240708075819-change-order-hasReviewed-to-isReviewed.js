module.exports = {
  async up(db, client) {
    await db
      .collection('orders')
      .updateMany(
        { hasReviewed: { $exists: true } },
        { $rename: { hasReviewed: 'isReviewed' } }
      );
  },

  async down(db, client) {
    await db
      .collection('orders')
      .updateMany(
        { isReviewed: { $exists: true } },
        { $rename: { isReviewed: 'hasReviewed' } }
      );
  },
};
