module.exports = {
  async up(db) {
    try {
      await db.collection('users').updateMany(
        {
          role: 'CUSTOMER',
        },
        {
          $set: {
            subscribedTo: {
              orderReminder: true,
            },
          },
        }
      );
    } catch (err) {
      // Log error
      console.log(err);
    }
  },

  async down(db) {
    try {
      await db
        .collection('users')
        .updateMany({ role: 'CUSTOMER' }, { $unset: { subscribedTo: '' } });
    } catch (err) {
      // Log error
      console.log(err);
    }
  },
};
