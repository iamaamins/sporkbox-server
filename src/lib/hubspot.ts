import { Client } from '@hubspot/api-client';
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/contacts';

const client = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

export async function createHSContact(
  email: string,
  firstName: string,
  lastName: string
) {
  try {
    await client.crm.contacts.basicApi.create({
      properties: {
        email,
        firstname: firstName,
        lastname: lastName,
        spork_box_newsletter_opt_in: 'true',
      },
    });

    console.log(`HubSpot contact created: ${email}`);
  } catch (err) {
    console.error(`Error creating HubSpot contact: ${email}`, err);
  }
}

export async function updateHSContact(email: string, isSubscribed: boolean) {
  try {
    const response = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              value: email,
              propertyName: 'email',
              operator: FilterOperatorEnum.Eq,
            },
          ],
        },
      ],
      properties: ['email'],
      limit: 1,
    });

    if (!response.results || !response.results.length)
      throw new Error(`HubSpot contact not found: ${email}`);

    await client.crm.contacts.basicApi.update(response.results[0].id, {
      properties: {
        spork_box_newsletter_opt_in: isSubscribed ? 'true' : 'false',
      },
    });

    console.log(
      `HubSpot contact updated: ${email} ${
        isSubscribed ? 'subscribed to' : 'unsubscribed from'
      } newsletter`
    );
  } catch (err) {
    console.error(`Error updating HubSpot contact: ${email}`, err);
  }
}
