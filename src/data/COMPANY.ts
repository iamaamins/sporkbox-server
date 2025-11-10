export const SHIFTS = ['DAY', 'NIGHT', 'GENERAL'] as const;
export type Shift = (typeof SHIFTS)[number];
