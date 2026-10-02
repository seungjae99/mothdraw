export const FAMILIES = ['rounded', 'pointed', 'swept', 'scalloped', 'tailed'] as const;
export type Family = typeof FAMILIES[number];
export const FAMILY_LABELS: Record<Family, string> = {
  rounded: 'Rounded', pointed: 'Pointed', swept: 'Swept',
  scalloped: 'Scalloped', tailed: 'Tailed',
};
