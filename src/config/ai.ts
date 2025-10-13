import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

export const client = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL,
  maxRetries: 3,
});

export const model = process.env.AI_MODEL as string;
