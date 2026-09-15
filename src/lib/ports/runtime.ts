/**
 * Feature-facing Cloudflare runtime accessors.
 * Concrete wiring lives in `src/lib/adapters/cloudflare-runtime.ts`.
 */
export {
  type CloudflareAnalyticsEngineDataset,
  type CloudflareCache,
  type CloudflareKVNamespace,
  type CloudflareQueue,
  type CloudflareR2Bucket,
  type CloudflareTraceSpan,
  getCloudflareAnalyticsEngineDataset,
  getCloudflareCalendarExportRebuildQueue,
  getCloudflareCalendarExportsNamespace,
  getCloudflareCatalogDetailCoreNamespace,
  getCloudflareNamedCache,
  getCloudflareR2PublicationsBucket,
  getCloudflareRuntimeTaskScheduler,
  getCloudflareWeatherNamespace,
  runCloudflareTraceSpan,
} from "../adapters/cloudflare-runtime";
