const express = require("express");
const cors = require("cors");
const error = require("./middleware/error");
require("dotenv").config();
require("express-async-errors");
const connectDB = require("./config/db");
const User = require("./routes/user");
const Customer = require("./routes/customer");
const Vendor = require("./routes/vendor");
const Restaurants = require("./routes/restaurants");

// Port
const PORT = process.env.PORT || 5100;

// Connect to database
connectDB();

// App
const app = express();

// Middleware
app.use(cors({ credentials: true, origin: process.env.SITE_URL }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use("/api/user", User);
app.use("/api/customer", Customer);
app.use("/api/vendor", Vendor);
app.use("/api/restaurants", Restaurants);

// Error middleware
app.use(error);

// Run the server
app.listen(PORT, () => console.log("Server running"));
