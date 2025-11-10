module.exports = {
  async up(db) {
    await db
      .collection('users')
      .updateMany(
        { role: 'CUSTOMER', shifts: { $exists: true } },
        { $unset: { shifts: '' } }
      );
  },

  async down(db) {
    await db.collection('users').updateMany({ role: 'CUSTOMER' }, [
      {
        $set: {
          shifts: {
            $map: {
              input: {
                $filter: {
                  input: '$companies',
                  as: 'company',
                  cond: {
                    $and: [
                      { $eq: ['$$company.status', 'ACTIVE'] },
                      { $ifNull: ['$$company.shift', false] },
                    ],
                  },
                },
              },
              as: 'activeCompany',
              in: { $toLower: '$$activeCompany.shift' },
            },
          },
        },
      },
    ]);
  },
};
