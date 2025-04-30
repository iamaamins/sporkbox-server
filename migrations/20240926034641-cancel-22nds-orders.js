module.exports = {
  async up(db) {
    await db.collection('orders').updateMany(
      {
        status: 'PROCESSING',
        'delivery.date': new Date('2024-09-22T00:00:00.000+00:00'),
      },
      {
        $set: {
          status: 'CANCELLED',
        },
      }
    );
  },

  async down(db) {
    await db.collection('orders').updateMany(
      {
        status: 'CANCELLED',
        'delivery.date': new Date('2024-09-22T00:00:00.000+00:00'),
      },
      {
        $set: {
          status: 'PROCESSING',
        },
      }
    );
  },
};
