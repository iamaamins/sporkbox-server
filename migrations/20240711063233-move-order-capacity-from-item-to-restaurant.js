module.exports = {
  async up(db, client) {
    await db.collection('restaurants').updateMany({}, [
      {
        $set: {
          orderCapacity: Infinity,
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $arrayToObject: {
                  $filter: {
                    input: { $objectToArray: '$$item' },
                    as: 'field',
                    cond: { $ne: ['$$field.k', 'orderCapacity'] },
                  },
                },
              },
            },
          },
        },
      },
    ]);
  },

  async down(db, client) {
    await db.collection('restaurants').updateMany({}, [
      {
        $set: {
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $mergeObjects: ['$$item', { orderCapacity: '$orderCapacity' }],
              },
            },
          },
        },
      },
      {
        $unset: 'orderCapacity',
      },
    ]);
  },
};
