module.exports = {
  async up(db, client) {
    await db.collection('orders').updateMany(
      { 'payment.amount': { $exists: true } },
      {
        $rename: { 'payment.amount': 'payment.distributed' },
      }
    );
  },

  async down(db, client) {
    await db.collection('orders').updateMany(
      { 'payment.distributed': { $exists: true } },
      {
        $rename: { 'payment.distributed': 'payment.amount' },
      }
    );
  },
};
