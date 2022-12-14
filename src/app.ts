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
import Customer from "./routes/customer";
import cookieParser from "cookie-parser";
import Favorite from "./routes/favorite";
import Restaurant from "./routes/restaurant";

// Config
dotenv.config();

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
    origin: "https://www.araqo.com",
  })
);

// https://www.araqo.com
// http://localhost:3000
// https://www.sporkbox.app

// Routes
app.use("/users", User);
app.use("/orders", Order);
app.use("/vendors", Vendor);
app.use("/customers", Customer);
app.use("/companies", Company);
app.use("/favorites", Favorite);
app.use("/restaurants", Restaurant);

// Error middleware
app.use(error);

// Run the server
app.listen(PORT, () => console.log("Server running"));
