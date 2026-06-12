import { recordCounterAndDuration } from "./metric-recording";

export function recordOAuthTokenRequestMetric(input: {
  grantType?: string | null;
  hasResource: boolean;
  status: number;
  durationMs: number;
}) {
  const labels = {
    grant_type: input.grantType ?? "unknown",
    has_resource: input.hasResource,
    status: input.status,
  };
  recordCounterAndDuration({
    counter: "life_ustc_oauth_token_requests_total",
    duration: "life_ustc_oauth_token_request_duration_ms",
    durationMs: input.durationMs,
    durationLabels: {
      grant_type: input.grantType ?? "unknown",
      has_resource: input.hasResource,
    },
    labels,
  });
}
