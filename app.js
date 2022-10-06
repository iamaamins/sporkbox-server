const express = require("express");
const cors = require("cors");
require("dotenv").config();
require("express-async-errors");
const connectDB = require("./config/db");
const error = require("./middleware/error");
const cookieParser = require("cookie-parser");
const User = require("./routes/user");
const Customer = require("./routes/customer");
const Company = require("./routes/company");
const Restaurant = require("./routes/restaurant");

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
app.use(cors({ credentials: true, origin: process.env.SITE_URL }));

// Routes
app.use("/api/user", User);
app.use("/api/customer", Customer);
app.use("/api/companies", Company);
app.use("/api/restaurants", Restaurant);

// Error middleware
app.use(error);

// Run the server
app.listen(PORT, () => console.log("Server running"));
