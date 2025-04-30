module.exports = {
  // Add index to each restaurant items
  async up(db) {
    try {
      await db.collection("restaurants").updateMany({}, [
        {
          $addFields: {
            items: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  $mergeObjects: [
                    "$$item",
                    {
                      index: {
                        $indexOfArray: ["$items", "$$item"],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ]);
    } catch (err) {
      // Log error
      console.log(err);
    }
  },

  // Remove index from each restaurant items
  async down(db) {
    try {
      await db.collection("restaurants").updateMany({}, [
        {
          $addFields: {
            items: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  $arrayToObject: {
                    $filter: {
                      input: {
                        $objectToArray: "$$item",
                      },
                      cond: {
                        $ne: ["$$this.k", "index"],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ]);
    } catch (err) {
      // Log error
      console.log(err);
    }
  },
};
