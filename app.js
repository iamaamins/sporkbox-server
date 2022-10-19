const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("express-async-errors");
const connectDB = require("./config/db");
const error = require("./middleware/error");
const cookieParser = require("cookie-parser");
const User = require("./routes/user");
const Order = require("./routes/order");
const Vendor = require("./routes/vendor");
const Company = require("./routes/company");
const Customer = require("./routes/customer");
const Restaurant = require("./routes/restaurant");
const ScheduledRestaurant = require("./routes/scheduledRestaurant");

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
app.use("/api/user", User);
app.use("/api/orders", Order);
app.use("/api/vendor", Vendor);
app.use("/api/customer", Customer);
app.use("/api/companies", Company);
app.use("/api/restaurants", Restaurant);
app.use("/api/scheduled-restaurants", ScheduledRestaurant);

// Error middleware
app.use(error);

// Run the server
app.listen(PORT, () => console.log("Server running"));
