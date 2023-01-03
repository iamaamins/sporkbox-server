import { MulterError } from "multer";
import { ErrorRequestHandler } from "express";

const handler: ErrorRequestHandler = (err, req, res, next) => {
  // If err is a multer error
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res
        .status(400)
        .json({ message: "Only .png, .jpg and .jpeg formats are allowed" });
    }
  }

  // Set error status
  res.status(res.statusCode || 500);

  // Set error message
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export default handler;
