export type CloudflareAnalyticsReadPort = {
  query(sql: string): Promise<readonly Record<string, unknown>[]>;
};

export {
  CLOUDFLARE_ANALYTICS_DATASET,
  CloudflareAnalyticsReadUnavailableError,
  clearCloudflareAnalyticsReadCache,
  getCloudflareAnalyticsReadPort,
} from "../adapters/cloudflare-analytics-read";
