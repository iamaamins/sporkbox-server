module.exports = {
  async up(db) {
    await db
      .collection("restaurants")
      .updateMany({ "items.addableIngredients": { $exists: true } }, [
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
                        addable: 0,
                        addons: "$$this.addableIngredients",
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $unset: "items.addableIngredients",
        },
      ]);
  },

  async down(db) {},
};
