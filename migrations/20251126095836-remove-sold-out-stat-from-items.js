module.exports = {
  async up(db) {
    await db
      .collection('restaurants')
      .updateMany({}, { $unset: { 'items.$[].soldOutStat': '' } });
  },

  async down(db) {
    await db
      .collection('restaurants')
      .updateMany({}, { $set: { 'items.$[].soldOutStat': [] } });
  },
};
