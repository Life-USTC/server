import { incrementCounter } from "./runtime-metrics";

export function recordCalendarFeedCacheMetric(input: {
  feed: "user";
  status: "hit" | "miss";
}) {
  incrementCounter("life_ustc_calendar_feed_cache_total", {
    feed: input.feed,
    status: input.status,
  });
}
