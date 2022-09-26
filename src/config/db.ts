import mongoose from "mongoose";

export default async function connectDB() {
  try {
    const connect = await mongoose.connect(process.env.MONGO_URI!);

    console.log(`Database connected: ${connect.connection.host}`);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}
