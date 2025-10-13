import { CronJob } from 'cron';
import User from '../models/user';
import Order from '../models/order';
import { client, model } from '../config/ai';

export async function updateFoodVibe() {
  try {
    const users = await User.find({ role: 'CUSTOMER', status: 'ACTIVE' })
      .select('_id')
      .lean();

    for (const user of users) {
      // Get orders from past 3 months
      const threeMonths = new Date();
      threeMonths.setMonth(threeMonths.getMonth() - 6);

      const orders = await Order.find({
        'customer._id': user._id,
        createdAt: { $gte: threeMonths },
      })
        .select('item')
        .lean();
      if (orders.length === 0) continue;

      const prompt = `
          You are a food preference analyzer.

          Given a user's past 3 months of food orders, select the **single most representative food vibe** from the list below.

          You must choose exactly one that best fits the user's dominant eating pattern.

          Food vibe descriptions:
          1. So Fresh, So Clean - loves light, fresh picks like salads, smoothies, and grain bowls.
          2. Me Likey Spicey - can't resist the heat: curries, tacos, hot sauces, Thai chilis.
          3. Me Have the Meats - always reaching for BBQ, burgers, steak, or meaty mains.
          4. Veggieful - piles their plate with veggie-packed dishes and plant-based options.
          5. Carb Loading - all about pasta, rice bowls, noodles, and bread-heavy meals.
          6. Comfort Craver - goes for cozy classics: mac & cheese, fried chicken, hearty soups.
          7. Globetrotter - adventurous eater trying new global cuisines each week.
          8. Lunch Influencer - always picks the trendiest spots or seasonal specials.
          9. Sweet & Treats - sneaks in desserts, pastries, bubble tea, or sugary add-ons.
          10. Balanced Boss - consistently orders a well-rounded mix: proteins, veggies, grains.
          11. Bowl Life - lives for bowls: poke, grain, noodle, or salad bowls all day.

          Guidelines:
          - Focus on recurring ingredients, dish types, or cuisine styles.
          - If multiple vibes apply, choose the one that reflects the majority of items.
          - If no clear dominant vibe, default to "Balanced Boss".
          - Return **only** the vibe name exactly as written above, with no extra text.

          Items (name | tags | description):
          ${orders
            .map(
              (order) =>
                `${order.item.name} | ${order.item.tags} | ${order.item.description}`
            )
            .join('\n')}
      `;

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a precise classifier that maps food orders to one vibe label.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
      });

      const content = response.choices?.[0].message.content;
      const vibe = content ? content.trim() : 'Balanced Boss';

      await User.updateOne({ _id: user._id }, { $set: { foodVibe: vibe } });
    }

    console.log('User food vibe updated');
  } catch (err) {
    console.error(err);
  }
}

// new CronJob(
//   '0 */1 * * * *',
//   () => {
//     console.log('Running every minute');
//     updateFoodVibe();
//   },
//   null,
//   true,
//   'America/Los_Angeles'
// );

// Run the food vibe analysis weekly
new CronJob(
  '0 0 3 * * Mon',
  () => {
    updateFoodVibe();
  },
  null,
  true,
  'America/Los_Angeles'
);
