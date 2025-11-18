module.exports = {
  async up(db) {
    await db.collection('users').updateMany({ companies: { $exists: true } }, [
      {
        $set: {
          companies: {
            $map: {
              input: '$companies',
              as: 'company',
              in: {
                $mergeObjects: [
                  '$$company',
                  {
                    isEnrolled: {
                      $cond: [
                        {
                          $eq: [
                            '$$company._id',
                            {
                              $arrayElemAt: [
                                {
                                  $map: {
                                    input: {
                                      $filter: {
                                        input: '$companies',
                                        as: 'c',
                                        cond: { $eq: ['$$c.status', 'ACTIVE'] },
                                      },
                                    },
                                    as: 'c',
                                    in: '$$c._id',
                                  },
                                },
                                0,
                              ],
                            },
                          ],
                        },
                        true,
                        false,
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
  },

  async down(db) {
    await db.collection('users').updateMany({ companies: { $exists: true } }, [
      {
        $set: {
          companies: {
            $map: {
              input: '$companies',
              as: 'company',
              in: {
                $let: {
                  vars: { comp: '$$company' },
                  in: {
                    $arrayToObject: {
                      $filter: {
                        input: { $objectToArray: '$$comp' },
                        as: 'kv',
                        cond: { $ne: ['$$kv.k', 'isEnrolled'] },
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
