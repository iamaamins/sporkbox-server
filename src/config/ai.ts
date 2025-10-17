import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

export const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
});
