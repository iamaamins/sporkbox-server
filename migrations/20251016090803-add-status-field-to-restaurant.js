module.exports = {
  async up(db) {
    const vendors = await db
      .collection('users')
      .find({ role: 'VENDOR' })
      .project({ restaurant: 1, status: 1 })
      .toArray();

    const bulkOps = vendors.map((vendor) => ({
      updateOne: {
        filter: { _id: vendor.restaurant },
        update: { $set: { status: vendor.status } },
      },
    }));

    await db.collection('restaurants').bulkWrite(bulkOps, { ordered: false });
  },

  async down(db) {
    await db
      .collection('restaurants')
      .updateMany({}, { $unset: { status: '' } });
  },
};
