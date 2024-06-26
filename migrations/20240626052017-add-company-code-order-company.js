module.exports = {
  async up(db) {
    const orders = await db.collection('orders').find().toArray();
    for (const order of orders) {
      const company = await db
        .collection('companies')
        .findOne({ _id: order.company._id });

      if (company) {
        await db
          .collection('orders')
          .updateOne(
            { _id: order._id },
            { $set: { 'company.code': company.code } }
          );
      }
    }
  },
  async down(db) {
    const orders = await db.collection('orders').find().toArray();

    for (const order of orders) {
      await db
        .collection('orders')
        .updateOne({ _id: order._id }, { $unset: { 'company.code': '' } });
    }
  },
};
