import { getOptionalTrimmedEnv } from "@/env";
import { renderPrometheusMetrics } from "@/lib/metrics/runtime-metrics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOCAL_METRICS_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const prefix = "Bearer ";
  return authorization?.startsWith(prefix)
    ? authorization.slice(prefix.length)
    : null;
}

function isLocalMetricsRequest(request: Request) {
  const url = new URL(request.url);
  const hostHeader = request.headers.get("host");
  const hostHeaderName = hostHeader
    ? normalizeHostHeaderName(hostHeader)
    : url.hostname;
  return (
    LOCAL_METRICS_HOSTS.has(url.hostname) ||
    LOCAL_METRICS_HOSTS.has(hostHeaderName)
  );
}

function normalizeHostHeaderName(hostHeader: string) {
  if (hostHeader.startsWith("[")) {
    return hostHeader.slice(1, hostHeader.indexOf("]"));
  }

  return hostHeader.split(":")[0];
}

function canReadMetrics(request: Request) {
  if (isLocalMetricsRequest(request)) {
    return true;
  }

  const token = getOptionalTrimmedEnv("METRICS_BEARER_TOKEN");
  return Boolean(token && getBearerToken(request) === token);
}

export function GET(request: Request) {
  if (!canReadMetrics(request)) {
    return new Response("Not found\n", { status: 404 });
  }

  return new Response(renderPrometheusMetrics(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
