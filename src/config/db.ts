import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log(`Database connected`);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}
