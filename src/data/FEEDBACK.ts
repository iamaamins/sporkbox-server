export const TYPES = ['GENERAL', 'ISSUE'] as const;
export const ISSUE_CATEGORIES = [
  'Missing Meal',
  'Incorrect Meal',
  'Late Delivery',
  'Quality Issue',
  'Portion Size',
  'Other',
] as const;
export type FeedbackType = (typeof TYPES)[number];
