import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config();

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function postSlackMessage(restaurant: string) {
  try {
    const response = await web.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID as string,
      text: `If you placed an order from ${restaurant} today, your lunch has been delivered!`,
    });

    if (!response.ok) return console.log('Failed to send Slack message');

    console.log('Slack message sent successfully!');
  } catch (err) {
    console.error(err);
  }
}
