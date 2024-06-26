module.exports = {
  async up(db) {
    const restaurants = await db.collection('restaurants').find().toArray();
    for (const restaurant of restaurants) {
      for (const schedule of restaurant.schedules) {
        const company = await db
          .collection('companies')
          .findOne({ _id: schedule.company._id });
        if (company) schedule.company.code = company.code;
      }
      await db
        .collection('restaurants')
        .updateOne(
          { _id: restaurant._id },
          { $set: { schedules: restaurant.schedules } }
        );
    }
  },
  async down(db) {
    const restaurants = await db.collection('restaurants').find().toArray();
    for (const restaurant of restaurants) {
      for (const schedule of restaurant.schedules) {
        delete schedule.company.code;
      }
      await db
        .collection('restaurants')
        .updateOne(
          { _id: restaurant._id },
          { $set: { schedules: restaurant.schedules } }
        );
    }
  },
};
