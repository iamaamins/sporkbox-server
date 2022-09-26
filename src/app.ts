import * as dotenv from "dotenv";
dotenv.config();
import express, { Application } from "express";
import connectDB from "./config/db";
import User from "./routes/customer";
import Admin from "./routes/admin";

// Port
const PORT = process.env.PORT || 5100;

// Connect to database
connectDB();

// App
const app: Application = express();

// Use express json
app.use(express.json());

// User route
app.use("/api/customer", User);
app.use("/api/admin", Admin);

// Run the server
app.listen(PORT, () => console.log("Server running"));
