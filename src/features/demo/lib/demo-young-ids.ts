export const DEMO_YOUNG_IDS = Array.from(
  { length: 42 },
  (_, index) => `demo-young-${index + 1}`,
);
export const DEMO_YOUNG_ORGANIZER_IDS = Array.from(
  { length: 22 },
  (_, index) => `demo-young-organizer-${index + 1}`,
);
export const isDemoYoungId = (id: string) => DEMO_YOUNG_IDS.includes(id);
export const isDemoYoungOrganizerId = (id: string) =>
  DEMO_YOUNG_ORGANIZER_IDS.includes(id);
