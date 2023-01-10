import { MulterError } from "multer";
import { ErrorRequestHandler } from "express";

const handler: ErrorRequestHandler = (err, req, res, next) => {
  // If err is a multer error
  if (err instanceof MulterError) {
    // If unexpected file format is provided
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res
        .status(400)
        .json({ message: "Only .png, .jpg and .jpeg formats are allowed" });
    }
  }

  // If error is a populate error
  if (err.name === "StrictPopulateError") {
    // Return err with response
    return res.status(500).json({
      message: "Failed to populate provided path",
    });
  }

  // If error is a cast error
  if (err.name === "CastError") {
    // Path
    const path = err.path;

    // Return err with response
    return res.status(500).json({
      message: `Please provide a valid ${path}`,
    });
  }

  // If error is a validation error
  if (err.name === "ValidationError") {
    // key
    const key = err.message.split(":")[1].trim();

    // Return err with response
    return res.status(500).json({
      message: `Please provide a valid ${key}`,
    });
  }

  // If error is a mongoose error
  if (err.name === "DocumentNotFoundError") {
    // Key
    const key = Object.keys(err.query)[0];

    // Value
    const value = Object.values(err.query)[0];

    // Model name
    const model = err.message
      .split(" ")
      [err.message.split(" ").length - 1].replaceAll('"', "");

    // Return err with response
    return res.status(500).json({
      message: `${model} with ${key} ${value} is not found`,
    });
  }

  // If error is a duplicate key error
  if (err.name === "MongoServerError" && err.code === 11000) {
    // Find the key
    const key = Object.keys(err.keyValue)[0];

    // Return err with response
    return res.status(500).json({
      message: `Please provide a unique ${key}`,
    });
  }

  // If jwt token is expired
  if (err.name === "TokenExpiredError") {
    // Send the error message
    return res
      .status(500)
      .json({ message: "Token expired, please request the service again" });
  }

  // If jwt token is invalid
  if (err.name === "JsonWebTokenError") {
    // Send the error message
    return res.status(500).json({ message: "Please provide a valid token" });
  }

  // If password salt is invalid
  if (err.message.includes("Invalid salt")) {
    // Send the error message
    return res.status(500).json({ message: "Please provide a valid salt" });
  }

  // Stripe signature verification error
  if (err.message.includes("StripeSignatureVerificationError")) {
    // Send the error message
    return res
      .status(400)
      .json({ message: "Stripe signature verification failed" });
  }

  // Stripe invalid checkout session id is provided
  if (err.message.includes("No such checkout.session")) {
    // Send the error message
    return res
      .status(400)
      .json({ message: "Please provide a valid checkout session" });
  }

  // Error thrown by throw new Error
  res.status(res.statusCode || 500).json({
    message: err.message,
  });
};

export default handler;
