// Client-side feature definitions
export const FEATURES = {
  crm: {
    default: false,
    label: 'CRM',
  },
} as const;

export type FeatureKey = keyof typeof FEATURES;
