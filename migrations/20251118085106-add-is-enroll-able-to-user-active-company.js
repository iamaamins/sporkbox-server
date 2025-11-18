module.exports = {
  async up(db) {
    // Collections
    const usersColl = db.collection('users');
    const companiesColl = db.collection('companies');

    // Get all companies and create a status map
    const companies = await companiesColl.find({}).toArray();
    const statusMap = new Map(
      companies.map((company) => [company._id.toString(), company.status])
    );

    // Get users who have companies
    const users = await usersColl
      .find({ companies: { $exists: true, $ne: [] } })
      .toArray();

    // Prepare bulk operations
    const bulkOps = [];

    for (const user of users) {
      const updatedCompanies = [];
      for (company of user.companies) {
        const status = statusMap.get(company._id.toString());
        if (!status) continue;

        updatedCompanies.push({
          ...company,
          status,
          isEnrollAble: status === 'ACTIVE',
        });
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { companies: updatedCompanies } },
        },
      });
    }

    // Execute bulk operations
    await usersColl.bulkWrite(bulkOps, {
      ordered: false,
    });
  },
};
