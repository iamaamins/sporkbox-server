module.exports = {
  async up(db) {
    const users = db.collection('users');
    const companies = db.collection('companies');

    const companiesWithSlack = await companies
      .find(
        { slackChannel: { $exists: true } },
        { projection: { _id: 1, slackChannel: 1 } }
      )
      .toArray();

    const slackMap = new Map(
      companiesWithSlack.map((c) => [c._id.toString(), c.slackChannel])
    );

    const usersWithCompanies = await users
      .find({ 'companies.0': { $exists: true } })
      .toArray();

    const bulkOps = [];
    for (const user of usersWithCompanies) {
      const updates = [];
      user.companies.forEach((company, index) => {
        const companyId = company._id.toString();
        const slackChannel = slackMap.get(companyId);

        if (slackChannel && slackChannel !== company.slackChannel)
          updates.push({
            [`companies.${index}.slackChannel`]: slackChannel,
          });
      });

      if (updates.length > 0) {
        const updateFields = Object.assign({}, ...updates);
        bulkOps.push({
          updateOne: {
            filter: { _id: user._id },
            update: { $set: updateFields },
          },
        });
      }
    }

    if (bulkOps.length > 0) await users.bulkWrite(bulkOps, { ordered: false });
  },

  async down(db) {
    const users = db.collection('users');
    await users.updateMany(
      { 'companies.0': { $exists: true } },
      { $unset: { 'companies.$[].slackChannel': '' } }
    );
  },
};
