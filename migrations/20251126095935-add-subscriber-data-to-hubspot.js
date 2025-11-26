const { Client } = require('@hubspot/api-client');

module.exports = {
  async up(db) {
    const client = new Client({
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
    });

    const customers = await db
      .collection('users')
      .find({ role: 'CUSTOMER' })
      .toArray();

    if (!customers || !customers.length)
      return console.log('No subscribers to sync');

    const batchSize = 100;
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);

      const inputs = batch.map((user) => ({
        properties: {
          email: user.email,
          firstname: user.firstName,
          lastname: user.lastName,
          spork_box_newsletter_opt_in: user.subscribedTo.newsletter
            ? 'true'
            : 'false',
        },
      }));

      try {
        await client.crm.contacts.batchApi.create({ inputs });
        console.log(`Created ${batch.length} HubSpot contacts`);
      } catch (err) {
        console.error(
          'Error batch creating HubSpot contacts, trying individual creates:',
          err
        );

        for (const user of batch) {
          try {
            const response = await client.crm.contacts.searchApi.doSearch({
              filterGroups: [
                {
                  filters: [
                    {
                      value: user.email,
                      propertyName: 'email',
                      operator: 'EQ',
                    },
                  ],
                },
              ],
              properties: ['email'],
              limit: 1,
            });

            if (!response.results || !response.results.length) {
              await client.crm.contacts.basicApi.create({
                properties: {
                  email: user.email,
                  firstname: user.firstName,
                  lastname: user.lastName,
                  spork_box_newsletter_opt_in: user.subscribedTo.newsletter
                    ? 'true'
                    : 'false',
                },
              });
            }
            console.log(`Synced HubSpot contact: ${user.email}`);
          } catch (err2) {
            console.error(`Error syncing HubSpot contact ${user.email}`, err2);
          }
        }
      }
    }
  },

  async down(db) {
    const client = new Client({
      accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
    });

    const customers = await db
      .collection('users')
      .find({ role: 'CUSTOMER' })
      .toArray();

    for (const user of customers) {
      try {
        const response = await client.crm.contacts.searchApi.doSearch({
          filterGroups: [
            {
              filters: [
                { propertyName: 'email', operator: 'EQ', value: user.email },
              ],
            },
          ],
          properties: ['email'],
          limit: 1,
        });

        if (response.results && response.results.length > 0) {
          await client.crm.contacts.basicApi.archive(response.results[0].id);
          console.log(`Archived HubSpot contact: ${user.email}`);
        }
      } catch (err) {
        console.error(`Error archiving HubSpot contact ${user.email}`, err);
      }
    }
  },
};
