import * as dotenv from "dotenv";
dotenv.config();
import express, { Application } from "express";
import connectDB from "./config/db";

connectDB();

const app: Application = express();

const PORT = process.env.PORT || 5100;

app.listen(PORT, () => console.log("Server running"));
