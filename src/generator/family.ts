export const FAMILIES = ['rounded', 'pointed', 'swept', 'scalloped', 'tailed'] as const;
export type Family = typeof FAMILIES[number];
export const FAMILY_LABELS: Record<Family, string> = {
  rounded: '둥근 날개', pointed: '뾰족한 날개', swept: '후퇴한 날개',
  scalloped: '물결 날개', tailed: '긴 꼬리 날개',
};
