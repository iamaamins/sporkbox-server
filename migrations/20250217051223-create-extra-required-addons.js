module.exports = {
  async up(db) {
    const restaurants = await db.collection('restaurants').find().toArray();

    for (const restaurant of restaurants) {
      await db.collection('restaurants').updateOne(
        { _id: restaurant._id },
        {
          $set: {
            'items.$[].extraRequiredAddons': { addons: '', addable: 0 },
          },
        }
      );
    }

    const orders = await db.collection('orders').find().toArray();

    for (const order of orders) {
      await db.collection('orders').updateOne(
        { _id: order._id },
        {
          $set: {
            'item.extraRequiredAddons': '',
          },
        }
      );
    }
  },

  async down(db) {
    const restaurants = await db.collection('restaurants').find().toArray();

    for (const restaurant of restaurants) {
      await db.collection('restaurants').updateOne(
        { _id: restaurant._id },
        {
          $unset: { 'items.$[].extraRequiredAddons': '' },
        }
      );
    }

    const orders = await db.collection('orders').find().toArray();

    for (const order of orders) {
      await db.collection('orders').updateOne(
        { _id: order._id },
        {
          $unset: {
            'item.extraRequiredAddons': '',
          },
        }
      );
    }
  },
};
