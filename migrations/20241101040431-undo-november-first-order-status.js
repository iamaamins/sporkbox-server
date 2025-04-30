module.exports = {
  async up(db) {
    await db.collection('orders').updateMany(
      {
        status: 'DELIVERED',
        'delivery.date': new Date('2024-11-01T00:00:00.000+00:00'),
      },
      {
        $set: {
          status: 'PROCESSING',
        },
      }
    );
  },
};
