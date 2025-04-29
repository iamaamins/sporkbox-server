module.exports = {
  async up(db) {
    await db
      .collection('orders')
      .updateMany({ pendingOrderId: { $exists: true } }, [
        { $set: { pendingKey: '$pendingOrderId' } },
        { $unset: 'pendingOrderId' },
      ]);
  },

  async down(db) {
    await db
      .collection('orders')
      .updateMany({ pendingKey: { $exists: true } }, [
        { $set: { pendingOrderId: '$pendingKey' } },
        { $unset: 'pendingKey' },
      ]);
  },
};
