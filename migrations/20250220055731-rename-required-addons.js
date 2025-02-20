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
                      requiredAddonOne: '$$item.requiredAddons',
                      requiredAddonTwo: '$$item.extraRequiredAddons',
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
            'item.requiredAddonOne': '$item.requiredAddons',
            'item.requiredAddonTwo': '$item.extraRequiredAddons',
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
        'items.requiredAddonOne': { $exists: true },
        'items.requiredAddonTwo': { $exists: true },
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
                      requiredAddons: '$$item.requiredAddonOne',
                      extraRequiredAddons: '$$item.requiredAddonTwo',
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $unset: ['items.requiredAddonOne', 'items.requiredAddonTwo'],
        },
      ]
    );

    await db.collection('orders').updateMany(
      {
        'item.requiredAddonOne': { $exists: true },
        'item.requiredAddonTwo': { $exists: true },
      },
      [
        {
          $set: {
            'item.requiredAddons': '$item.requiredAddonOne',
            'item.extraRequiredAddons': '$item.requiredAddonTwo',
          },
        },
        {
          $unset: ['item.requiredAddonOne', 'item.requiredAddonTwo'],
        },
      ]
    );
  },
};
