import express from "express";
import cors from "cors";
import "express-async-errors";
import * as dotenv from "dotenv";
import User from "./routes/user";
import Order from "./routes/order";
import Vendor from "./routes/vendor";
import Company from "./routes/company";
import error from "./middleware/error";
import { connectDB } from "./config/db";
import { allowedOrigins } from "./utils";
import Customer from "./routes/customer";
import cookieParser from "cookie-parser";
import Favorite from "./routes/favorite";
import Restaurant from "./routes/restaurant";
import credentials from "./middleware/credentials";

// Config
dotenv.config();

// Port
const PORT = process.env.PORT || 5100;

// Connect to database
connectDB();

// App
const app = express();

// Middleware
// app.use(credentials);
app.options(
  "*",
  cors({
    credentials: true,
    origin: allowedOrigins,
    preflightContinue: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(
  cors({
    credentials: true,
    origin: allowedOrigins,
    preflightContinue: true,
  })
);

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
