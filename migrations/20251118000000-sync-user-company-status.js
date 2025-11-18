module.exports = {
  async up(db) {
    const usersCollection = db.collection('users');
    const companiesCollection = db.collection('companies');

    try {
      // Get all companies
      const companies = await companiesCollection.find({}).toArray();
      const companyStatusMap = new Map(
        companies.map((company) => [company._id.toString(), company.status])
      );

      // Get users who have companies
      const users = await usersCollection
        .find({ companies: { $exists: true, $ne: [] } })
        .toArray();
      if (!users.length) return console.log('No users with companies found');

      // Prepare bulk operations
      const bulkOps = [];

      for (const user of users) {
        let hasChanges = false;

        const updatedCompanies = user.companies.map((userCompany) => {
          const companyStatus = companyStatusMap.get(
            userCompany._id.toString()
          );

          // Compare only if the company exists in the map
          if (companyStatus && userCompany.status !== companyStatus) {
            hasChanges = true;
            return { ...userCompany, status: companyStatus };
          }

          return userCompany;
        });

        if (hasChanges)
          bulkOps.push({
            updateOne: {
              filter: { _id: user._id },
              update: { $set: { companies: updatedCompanies } },
            },
          });
      }

      if (!bulkOps.length)
        return console.log('All user company statuses are already in sync');

      // Execute bulk operations
      const result = await usersCollection.bulkWrite(bulkOps, {
        ordered: false,
      });

      console.log(`Updated ${result.modifiedCount} users`);
    } catch (error) {
      console.error('Error during migration:', error);
    }
  },
};
