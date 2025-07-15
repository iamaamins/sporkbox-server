import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config();

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function postSlackMessage(restaurant: string, channel: string) {
  try {
    const response = await web.chat.postMessage({
      channel,
      text: `If you placed an order from ${restaurant} today, your lunch has been delivered!`,
    });

    if (!response.ok)
      throw new Error(
        `Failed to send Slack message to ${channel}: ${response}`
      );
  } catch (err) {
    console.error(err);
    throw err;
  }
}
