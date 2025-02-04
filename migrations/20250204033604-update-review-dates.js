module.exports = {
  async up(db) {
    const restaurants = await db.collection('restaurants').find().toArray();
    const orders = await db
      .collection('orders')
      .find({ isReviewed: true, updatedAt: { $lt: new Date('2025-06-01') } })
      .toArray();

    const itemsMap = new Map();
    for (const order of orders) {
      const key = `${order.item._id.toString()}-${order.customer._id.toString()}`;
      itemsMap.set(key, order.updatedAt);
    }

    const bulkUpdates = [];
    for (const restaurant of restaurants) {
      for (const item of restaurant.items) {
        for (const review of item.reviews) {
          const key = `${item._id.toString()}-${review.customer.toString()}`;
          if (
            new Date(review.createdAt).getTime() < new Date('2025-06-01') &&
            new Date(review.createdAt) > new Date('2025-04-01') &&
            itemsMap.has(key)
          ) {
            bulkUpdates.push({
              updateOne: {
                filter: {
                  _id: restaurant._id,
                  'items._id': item._id,
                },
                update: {
                  $set: {
                    'items.$[i].reviews.$[r].createdAt': itemsMap.get(key),
                    'items.$[i].reviews.$[r].updatedAt': itemsMap.get(key),
                  },
                },
                arrayFilters: [
                  { 'i._id': item._id },
                  {
                    'r.customer': review.customer,
                    'r.createdAt': {
                      $gt: new Date('2025-04-01'),
                      $lt: new Date('2025-06-01'),
                    },
                  },
                ],
              },
            });
          }
        }
      }
    }

    if (bulkUpdates.length)
      await db.collection('restaurants').bulkWrite(bulkUpdates);
  },

  async down(db) {
    const restaurants = await db.collection('restaurants').find().toArray();

    const bulkUpdates = [];
    for (const restaurant of restaurants) {
      for (const item of restaurant.items) {
        for (const review of item.reviews) {
          if (
            new Date(review.createdAt).getTime() < new Date('2025-06-01') &&
            new Date(review.createdAt) > new Date('2025-04-01')
          ) {
            bulkUpdates.push({
              updateOne: {
                filter: {
                  _id: restaurant._id,
                  'items._id': item._id,
                },
                update: {
                  $set: {
                    'items.$[i].reviews.$[r].createdAt': new Date('2025-05-01'),
                    'items.$[i].reviews.$[r].updatedAt': new Date('2025-05-01'),
                  },
                },
                arrayFilters: [
                  { 'i._id': item._id },

                  {
                    'r.customer': review.customer,
                    'r.createdAt': {
                      $gt: new Date('2025-04-01'),
                      $lt: new Date('2025-06-01'),
                    },
                  },
                ],
              },
            });
          }
        }
      }
    }

    if (bulkUpdates.length)
      await db.collection('restaurants').bulkWrite(bulkUpdates);
  },
};
