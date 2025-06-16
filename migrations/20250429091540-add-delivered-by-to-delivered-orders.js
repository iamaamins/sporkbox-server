const { ObjectId } = require('mongodb');

module.exports = {
  async up(db) {
    const admin = await db.collection('users').findOne({
      role: 'ADMIN',
      status: 'ACTIVE',
      email: 'tim@sporkbytes.com',
    });

    await db.collection('orders').updateMany(
      { status: 'DELIVERED', deliveredBy: { $exists: false } },
      {
        $set: {
          deliveredBy: {
            id: new ObjectId(admin?._id || '633143933b4247340f553100'),
            firstName: admin?.firstName || 'Tim',
            lastName: admin?.lastName || 'Taylor',
          },
        },
      }
    );
  },

  async down(db) {
    await db
      .collection('orders')
      .updateMany(
        { status: 'DELIVERED', deliveredBy: { $exists: true } },
        { $unset: { deliveredBy: '' } }
      );
  },
};
