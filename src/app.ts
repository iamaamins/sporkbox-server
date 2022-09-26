import express, { Application, Request, Response, NextFunction } from "express";

const app: Application = express();

const PORT = process.env.PORT || 5100;

app.listen(PORT, () => console.log("Server running"));
