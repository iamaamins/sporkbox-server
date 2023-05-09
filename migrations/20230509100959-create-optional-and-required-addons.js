module.exports = {
  async up(db) {
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
                      addable: 0,
                      addons: "$$this.addableIngredients",
                    },
                    requiredAddons: {
                      addable: 0,
                      addons: "",
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
