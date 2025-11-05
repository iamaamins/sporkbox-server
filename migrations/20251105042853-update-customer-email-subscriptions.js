module.exports = {
  async up(db) {
    await db.collection('users').updateMany(
      { role: 'CUSTOMER' },
      {
        $set: {
          'subscribedTo.newsletter': true,
          'subscribedTo.deliveryNotification': true,
        },
      }
    );
  },

  async down(db) {
    await db.collection('users').updateMany(
      { role: 'CUSTOMER' },
      {
        $unset: {
          'subscribedTo.newsletter': '',
          'subscribedTo.deliveryNotification': '',
        },
      }
    );
  },
};
