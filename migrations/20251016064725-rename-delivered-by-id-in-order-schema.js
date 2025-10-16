module.exports = {
  async up(db) {
    await db
      .collection('orders')
      .updateMany(
        { status: 'DELIVERED', 'deliveredBy.id': { $exists: true } },
        [
          { $set: { 'deliveredBy._id': '$deliveredBy.id' } },
          { $unset: 'deliveredBy.id' },
        ]
      );
  },

  async down(db) {
    await db
      .collection('orders')
      .updateMany(
        { status: 'DELIVERED', 'deliveredBy._id': { $exists: true } },
        [
          { $set: { 'deliveredBy.id': '$deliveredBy._id' } },
          { $unset: 'deliveredBy._id' },
        ]
      );
  },
};
