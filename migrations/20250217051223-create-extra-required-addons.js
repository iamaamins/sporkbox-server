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
                  {
                    extraRequiredAddons: {
                      $cond: {
                        if: {
                          $ifNull: ['$$item.extraRequiredAddons', false],
                        },
                        then: '$$item.extraRequiredAddons',
                        else: { addons: '', addable: 0 },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ]);

    await db
      .collection('orders')
      .updateMany(
        { 'item.extraRequiredAddons': { $exists: false } },
        { $set: { 'item.extraRequiredAddons': '' } }
      );
  },

  async down(db) {
    await db.collection('restaurants').updateMany({}, [
      {
        $set: {
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                $arrayToObject: {
                  $filter: {
                    input: { $objectToArray: '$$item' },
                    as: 'field',
                    cond: { $ne: ['$$field.k', 'extraRequiredAddons'] },
                  },
                },
              },
            },
          },
        },
      },
    ]);

    await db
      .collection('orders')
      .updateMany({}, { $unset: { 'item.extraRequiredAddons': '' } });
  },
};
