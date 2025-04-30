module.exports = {
  async up(db) {
    await db.collection('restaurants').updateMany({}, [
      {
        $set: {
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $mergeObjects: [
                  '$$item',
                  { orderCapacity: Number.POSITIVE_INFINITY },
                ],
              },
            },
          },
        },
      },
      { $unset: 'orderCapacity' },
    ]);
  },

  async down(db) {
    await db.collection('restaurants').updateMany({}, [
      {
        $set: {
          orderCapacity: { $arrayElemAt: ['$items.orderCapacity', 0] },
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $let: {
                  vars: { item: '$$item' },
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
        },
      },
    ]);
  },
};
