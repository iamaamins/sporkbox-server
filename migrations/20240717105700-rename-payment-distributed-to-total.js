module.exports = {
  async up(db, client) {
    await db.collection('orders').updateMany(
      { 'payment.distributed': { $exists: true } },
      {
        $rename: { 'payment.distributed': 'payment.total' },
      }
    );
  },

  async down(db, client) {
    await db.collection('orders').updateMany(
      { 'payment.total': { $exists: true } },
      {
        $rename: { 'payment.total': 'payment.distributed' },
      }
    );
  },
};
