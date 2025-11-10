module.exports = {
  async up(db) {
    // Update companies collection
    await db
      .collection('companies')
      .updateMany({}, [{ $set: { shift: { $toUpper: '$shift' } } }]);

    // Update orders collection
    await db
      .collection('orders')
      .updateMany({}, [
        { $set: { 'company.shift': { $toUpper: '$company.shift' } } },
      ]);

    // Update restaurants collection (schedules array)
    await db.collection('restaurants').updateMany({}, [
      {
        $set: {
          schedules: {
            $map: {
              input: '$schedules',
              as: 'schedule',
              in: {
                $mergeObjects: [
                  '$$schedule',
                  {
                    company: {
                      $mergeObjects: [
                        '$$schedule.company',
                        { shift: { $toUpper: '$$schedule.company.shift' } },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ]);

    // Update users collection (companies array)
    await db.collection('users').updateMany({ role: 'CUSTOMER' }, [
      {
        $set: {
          companies: {
            $map: {
              input: '$companies',
              as: 'company',
              in: {
                $mergeObjects: [
                  '$$company',
                  { shift: { $toUpper: '$$company.shift' } },
                ],
              },
            },
          },
        },
      },
    ]);
  },

  async down(db) {
    // Revert companies collection
    await db
      .collection('companies')
      .updateMany({}, [{ $set: { shift: { $toLower: '$shift' } } }]);

    // Revert orders collection
    await db
      .collection('orders')
      .updateMany({}, [
        { $set: { 'company.shift': { $toLower: '$company.shift' } } },
      ]);

    // Revert restaurants collection (schedules array)
    await db.collection('restaurants').updateMany({}, [
      {
        $set: {
          schedules: {
            $map: {
              input: '$schedules',
              as: 'schedule',
              in: {
                $mergeObjects: [
                  '$$schedule',
                  {
                    company: {
                      $mergeObjects: [
                        '$$schedule.company',
                        { shift: { $toLower: '$$schedule.company.shift' } },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ]);

    // Revert users collection (companies array)
    await db.collection('users').updateMany({ role: 'CUSTOMER' }, [
      {
        $set: {
          companies: {
            $map: {
              input: '$companies',
              as: 'company',
              in: {
                $mergeObjects: [
                  '$$company',
                  { shift: { $toLower: '$$company.shift' } },
                ],
              },
            },
          },
        },
      },
    ]);
  },
};
