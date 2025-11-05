export const EMAIL_SUBSCRIPTIONS = {
  deliveryNotification: true,
  orderReminder: true,
  newsletter: true,
} as const;

export type EmailSubscriptions = typeof EMAIL_SUBSCRIPTIONS;
