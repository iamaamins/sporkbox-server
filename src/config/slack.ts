import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config();

const web = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function postSlackMessage(restaurant: string, channel: string) {
  const maxRetries = 3;
  const delayMs = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await web.chat.postMessage({
        channel,
        text: `If you placed an order from ${restaurant} today, your lunch has been delivered!`,
      });

      if (!response.ok)
        throw new Error(
          `Failed to send Slack message to ${channel}: ${response}`
        );

      return response;
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err);

      if (attempt === maxRetries) {
        console.error(`All ${maxRetries} attempts failed.`);
        throw err;
      }

      await new Promise((res) => setTimeout(res, delayMs * attempt));
    }
  }
}
