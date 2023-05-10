module.exports = {
  async up(db) {
    try {
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
    } catch (err) {
      // Log error
      console.log(err);
    }
  },

  async down(db) {},
};
