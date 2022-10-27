import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import { connectDB } from "./config/db";
import error from "./middleware/error";
import cookieParser from "cookie-parser";
import User from "./routes/user";
import Order from "./routes/order";
import Vendor from "./routes/vendor";
import Company from "./routes/company";
import Customer from "./routes/customer";
import Favorite from "./routes/favorite";
import Restaurant from "./routes/restaurant";

// Config
dotenv.config();
require("express-async-errors");

// Port
const PORT = process.env.PORT || 5100;

// Connect to database
connectDB();

// App
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(
  cors({
    credentials: true,
    origin: "https://sporkbytes.vercel.app",
  })
);

// origins
// http://localhost:3000
// https://sporkbytes.vercel.app

// Routes
app.use("/api/users", User);
app.use("/api/orders", Order);
app.use("/api/vendors", Vendor);
app.use("/api/customers", Customer);
app.use("/api/companies", Company);
app.use("/api/favorites", Favorite);
app.use("/api/restaurants", Restaurant);

// Error middleware
app.use(error);

// Run the server
app.listen(PORT, () => console.log("Server running"));
