module.exports = {
  async up(db) {
    await db.collection("orders").updateMany({}, [
      {
        $addFields: {
          "item.requiredAddons": "",
          "item.optionalAddons": "$item.addedIngredients",
        },
      },
      {
        $unset: "item.addedIngredients",
      },
    ]);
  },

  async down(db) {},
};
