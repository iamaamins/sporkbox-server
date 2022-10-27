import { ErrorRequestHandler } from "express";

const handler: ErrorRequestHandler = (err, req, res, next) => {
  // Set error status
  res.status(res.statusCode || 500);

  // Set error message
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export default handler;
