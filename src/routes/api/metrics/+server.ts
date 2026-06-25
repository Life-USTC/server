import { notFoundText } from "@/lib/api/helpers";
import { canReadInternalEndpoint } from "@/lib/http/access-control";
import { renderPrometheusMetrics } from "@/lib/metrics/runtime-metrics";

/**
 * Export internal runtime metrics.
 * @response 200:text
 * @response 404
 */
export function GET({ request }: { request: Request }) {
  if (!canReadInternalEndpoint(request, ["METRICS_BEARER_TOKEN"])) {
    return notFoundText();
  }

  return new Response(renderPrometheusMetrics(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
