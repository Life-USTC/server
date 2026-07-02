import { getCloudflareAnalyticsEngineDataset } from "@/lib/adapters/cloudflare-runtime";

type ApiRequestAnalyticsInput = {
  authMode: string;
  durationMs: number;
  event: "finish" | "error";
  method: string;
  route: string;
  status: number;
};

function statusClass(status: number) {
  if (!Number.isFinite(status)) return "unknown";
  return `${Math.floor(status / 100)}xx`;
}

function boundedValue(value: string) {
  return value.replaceAll("\n", " ").slice(0, 120) || "unknown";
}

export function writeApiRequestAnalytics(input: ApiRequestAnalyticsInput) {
  const dataset = getCloudflareAnalyticsEngineDataset();
  if (!dataset) return;

  try {
    dataset.writeDataPoint({
      indexes: [boundedValue(input.route)],
      blobs: [
        "api_request",
        input.event,
        boundedValue(input.method),
        boundedValue(input.route),
        String(input.status),
        statusClass(input.status),
        boundedValue(input.authMode),
      ],
      doubles: [Math.max(0, input.durationMs), input.status],
    });
  } catch {
    // Analytics Engine must never affect the user-facing request path.
  }
}
