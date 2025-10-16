import { Schema, model, Types } from 'mongoose';

export interface Issue {
  title: string;
  date: Date;
  restaurant: { _id: Types.ObjectId; name: string };
  message: string;
  isValidated: boolean;
}

export interface FeedbackSchema {
  customer: { _id: Types.ObjectId; firstName: string; lastName: string };
  type: 'RATING' | 'ISSUE';
  rating?: number;
  issue?: Issue;
}

const feedbackSchema = new Schema<FeedbackSchema>(
  {
    customer: {
      _id: {
        type: Schema.Types.ObjectId,
        required: [true, 'Please provide customer id'],
      },
      firstName: {
        type: String,
        trim: true,
        required: [true, 'Please provide customer first name'],
      },
      lastName: {
        type: String,
        trim: true,
        required: [true, 'Please provide customer last name'],
      },
    },
    type: {
      type: String,
      enum: ['RATING', 'ISSUE'],
      required: [true, 'Please provide a feedback type'],
    },
    rating: { type: Number, min: 1, max: 5 },
    issue: {
      title: { type: String, trim: true },
      date: Date,
      restaurant: {
        _id: { type: Schema.Types.ObjectId },
        name: { type: String, trim: true },
      },
      message: { type: String, trim: true },
      isValidated: Boolean,
    },
  },
  { timestamps: true }
);

export default model('Feedback', feedbackSchema);
