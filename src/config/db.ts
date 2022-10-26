import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  try {
    // Connect to mongo db
    await mongoose.connect(process.env.MONGO_URI as string);

    // Confirm that the db is connected
    console.log(`Database connected`);
  } catch (err) {
    // Console log err and exit the process
    console.log(err);
    process.exit(1);
  }
}
