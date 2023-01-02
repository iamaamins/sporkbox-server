import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import "express-async-errors";
import mail from "@sendgrid/mail";
import User from "./routes/user";
import Order from "./routes/order";
import Vendor from "./routes/vendor";
import Company from "./routes/company";
import error from "./middleware/error";
import { connectDB } from "./config/db";
import Customer from "./routes/customer";
import Favorite from "./routes/favorite";
import cookieParser from "cookie-parser";
import Restaurant from "./routes/restaurant";

// Config
dotenv.config();

// Port
const PORT = process.env.PORT || 5100;

// Connect to database
connectDB();

// Configure mail
mail.setApiKey(process.env.SENDGRID_API_KEY as string);

// App
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(
  cors({
    credentials: true,
    origin: "https://sporkbox.octib.com",
  })
);

// https://www.sporkbox.app
// https://sporkbox.octib.com

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
