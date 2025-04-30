module.exports = {
  async up(db) {
    await db.collection('restaurants').updateMany(
      {
        'items.requiredAddons': { $exists: true },
        'items.extraRequiredAddons': { $exists: true },
      },
      [
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
                      requiredAddonsOne: '$$item.requiredAddons',
                      requiredAddonsTwo: '$$item.extraRequiredAddons',
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $unset: ['items.requiredAddons', 'items.extraRequiredAddons'],
        },
      ]
    );

    await db.collection('orders').updateMany(
      {
        'item.requiredAddons': { $exists: true },
        'item.extraRequiredAddons': { $exists: true },
      },
      [
        {
          $set: {
            'item.requiredAddonsOne': '$item.requiredAddons',
            'item.requiredAddonsTwo': '$item.extraRequiredAddons',
          },
        },
        {
          $unset: ['item.requiredAddons', 'item.extraRequiredAddons'],
        },
      ]
    );
  },

  async down(db) {
    await db.collection('restaurants').updateMany(
      {
        'items.requiredAddonsOne': { $exists: true },
        'items.requiredAddonsTwo': { $exists: true },
      },
      [
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
                      requiredAddons: '$$item.requiredAddonsOne',
                      extraRequiredAddons: '$$item.requiredAddonsTwo',
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $unset: ['items.requiredAddonsOne', 'items.requiredAddonsTwo'],
        },
      ]
    );

    await db.collection('orders').updateMany(
      {
        'item.requiredAddonsOne': { $exists: true },
        'item.requiredAddonsTwo': { $exists: true },
      },
      [
        {
          $set: {
            'item.requiredAddons': '$item.requiredAddonsOne',
            'item.extraRequiredAddons': '$item.requiredAddonsTwo',
          },
        },
        {
          $unset: ['item.requiredAddonsOne', 'item.requiredAddonsTwo'],
        },
      ]
    );
  },
};
