export const DEMO_NEWS_IDS = Array.from(
  { length: 22 },
  (_, index) => `demo-news-${index + 1}`,
);
export function isDemoNewsId(id: string) {
  return DEMO_NEWS_IDS.includes(id);
}
