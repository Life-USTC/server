import { timingSafeSecretEqual } from "@/lib/auth/secret-comparison";
import { getOptionalTrimmedEnv } from "@/lib/ports/env";
import { readPrometheusMetrics } from "./prometheus-metrics-data";
import { renderPrometheusMetrics } from "./prometheus-metrics-render";

const HEADERS = {
  "Cache-Control": "private, no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

/** A dedicated machine credential; cookies and OAuth grants never authorize a scrape. */
export async function servePrometheusMetrics(request: Request) {
  const expected = getOptionalTrimmedEnv("METRICS_SECRET");
  const authorization = request.headers.get("authorization") ?? "";
  const candidate = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1];
  if (
    !expected ||
    !candidate ||
    candidate.length > 4096 ||
    !(await timingSafeSecretEqual(candidate, expected))
  ) {
    return new Response("Unauthorized\n", {
      status: 401,
      headers: { ...HEADERS, "WWW-Authenticate": 'Bearer realm="metrics"' },
    });
  }

  try {
    const snapshot = await readPrometheusMetrics();
    return new Response(renderPrometheusMetrics(snapshot), {
      headers: HEADERS,
    });
  } catch {
    // A failed collection must make Prometheus mark the scrape down, not ingest zeros.
    return new Response("Metrics unavailable\n", {
      status: 503,
      headers: { ...HEADERS, "Retry-After": "60" },
    });
  }
}
