import { MulterError } from 'multer';
import { ErrorRequestHandler } from 'express';
import { invalidCredentials } from '../lib/messages';

const handler: ErrorRequestHandler = (err, req, res, next) => {
  // Multer error
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res
        .status(400)
        .json({ message: 'Only .png, .jpg and .jpeg formats are allowed' });
    }
  }

  // Populate error
  if (err.name === 'StrictPopulateError') {
    return res.status(500).json({
      message: 'Failed to populate provided path',
    });
  }

  // Cast error
  if (err.name === 'CastError') {
    const path = err.path;
    return res.status(500).json({
      message: `Please provide a valid ${path}`,
    });
  }

  // Invalid key
  if (err.name === 'ValidationError') {
    const key = err.message.split(':')[1].trim();
    return res.status(500).json({
      message: `Please provide a valid ${key}`,
    });
  }

  // Document not found
  if (err.name === 'DocumentNotFoundError') {
    const model = err.message
      .split(' ')
      [err.message.split(' ').length - 1].replaceAll('"', '');

    return res.status(500).json({
      message: `No ${model} found`,
    });
  }

  // Duplicate key error
  if (err.name === 'MongoServerError' && err.code === 11000) {
    const key = Object.keys(err.keyValue)[0];
    return res.status(500).json({
      message: `Please provide a unique ${key}`,
    });
  }

  // Expired JWT
  if (err.name === 'TokenExpiredError') {
    return res.status(500).json({ message: invalidCredentials });
  }

  // Invalid JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(500).json({ message: invalidCredentials });
  }

  // Invalid salt
  if (err.message.includes('Invalid salt')) {
    return res.status(500).json({ message: 'Please provide a valid salt' });
  }

  // Stripe signature verification error
  if (err.message.includes('StripeSignatureVerificationError')) {
    return res
      .status(400)
      .json({ message: 'Stripe signature verification failed' });
  }

  // Stripe invalid checkout session id
  if (err.message.includes('No such checkout.session')) {
    return res
      .status(400)
      .json({ message: 'Please provide a valid checkout session' });
  }

  // Stripe checkout amount too small
  if (err.message.includes('at least $0.50 usd')) {
    return res
      .status(400)
      .json({ message: 'Checkout amount must be $.5 or more' });
  }

  // Error thrown by throw new Error
  res.status(res.statusCode || 500).json({
    message: err.message,
  });
};

export default handler;
