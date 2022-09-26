import express from "express";
import * as dotenv from "dotenv";
import cors from "cors";
dotenv.config();
import connectDB from "./config/db";
import User from "./routes/customer";
import Admin from "./routes/admin";

// Port
const PORT = process.env.PORT || 5100;

// Connect to database
connectDB();

// App
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// User route
app.use("/api/customer", User);
app.use("/api/admin", Admin);

// Run the server
app.listen(PORT, () => console.log("Server running"));
