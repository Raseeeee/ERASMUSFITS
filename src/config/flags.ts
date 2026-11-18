/** Feature flags de monetización (SPEC §11). Todo desactivado en el MVP. */
export const flags = {
  premium: false,
  affiliate: false,
  ads: false,
} as const;

export type FlagName = keyof typeof flags;
