module.exports = {
  async up(db) {
    try {
      await db.collection("restaurants").updateMany({}, [
        {
          $set: {
            items: {
              $map: {
                input: "$items",
                in: {
                  $mergeObjects: [
                    "$$this",
                    {
                      optionalAddons: {
                        addons: "$$this.optionalAddons.addons",
                        addable: {
                          $cond: {
                            if: {
                              $ne: ["$$this.optionalAddons.addons", ""],
                            },
                            then: {
                              $size: {
                                $split: ["$$this.optionalAddons.addons", ", "],
                              },
                            },
                            else: 0,
                          },
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
    } catch (err) {
      // Log error
      console.log(err);
    }
  },
};
