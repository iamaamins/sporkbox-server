const mongoose = require("mongoose");

async function connectDB() {
  try {
    // Connect to mongo db
    const connect = await mongoose.connect(process.env.MONGO_URI);

    // Confirm that the db is connected
    console.log(`Database connected: ${connect.connection.host}`);
  } catch (err) {
    // Console log err and exit the process
    console.log(err);
    process.exit(1);
  }
}

module.exports = connectDB;
