export const STATUS = ['ARCHIVED', 'ACTIVE'] as const;
export type Status = (typeof STATUS)[number];
