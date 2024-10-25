import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import express from 'express';
import 'express-async-errors';
import User from './routes/user';
import mail from '@sendgrid/mail';
import { unless } from './lib/utils';
import Stat from './routes/stat';
import Admin from './routes/admin';
import Order from './routes/order';
import Stripe from './routes/stripe';
const xssClean = require('xss-clean');
import Vendor from './routes/vendor';
import Company from './routes/company';
import Data from './routes/data';
import error from './middleware/error';
import { connectDB } from './config/db';
import Customer from './routes/customer';
import Email from './routes/email';
import Favorite from './routes/favorite';
import cookieParser from 'cookie-parser';
import Restaurant from './routes/restaurant';
import Discount from './routes/discount';
import mongoSanitize from 'express-mongo-sanitize';

dotenv.config();
const PORT = process.env.PORT || 5100;
connectDB();
mail.setApiKey(process.env.SENDGRID_API_KEY as string);

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(mongoSanitize());
app.use(unless('/stripe/webhook', xssClean()));
app.use(unless('/stripe/webhook', express.json()));
app.use(express.urlencoded({ extended: false }));
app.use(
  cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
  })
);
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/users', User);
app.use('/stats', Stat);
app.use('/orders', Order);
app.use('/admins', Admin);
app.use('/data', Data);
app.use('/stripe', Stripe);
app.use('/vendors', Vendor);
app.use('/companies', Company);
app.use('/favorites', Favorite);
app.use('/customers', Customer);
app.use('/restaurants', Restaurant);
app.use('/discount-code', Discount);
app.use('/email', Email);

app.use(error);

app.listen(PORT, () => console.log('Server started'));
