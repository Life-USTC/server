import { getOptionalTrimmedEnv, getStorageEnv } from "@/env";
import { jsonResponse } from "@/lib/api/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOCAL_READINESS_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const prefix = "Bearer ";
  return authorization?.startsWith(prefix)
    ? authorization.slice(prefix.length)
    : null;
}

function normalizeHostHeaderName(hostHeader: string) {
  if (hostHeader.startsWith("[")) {
    return hostHeader.slice(1, hostHeader.indexOf("]"));
  }

  return hostHeader.split(":")[0];
}

function isLocalReadinessRequest(request: Request) {
  const url = new URL(request.url);
  const hostHeader = request.headers.get("host");
  const hostHeaderName = hostHeader
    ? normalizeHostHeaderName(hostHeader)
    : url.hostname;
  return (
    LOCAL_READINESS_HOSTS.has(url.hostname) ||
    LOCAL_READINESS_HOSTS.has(hostHeaderName)
  );
}

function canReadReadiness(request: Request) {
  if (isLocalReadinessRequest(request)) {
    return true;
  }

  const token =
    getOptionalTrimmedEnv("READINESS_BEARER_TOKEN") ??
    getOptionalTrimmedEnv("METRICS_BEARER_TOKEN");
  return Boolean(token && getBearerToken(request) === token);
}

async function checkDatabase() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", durationMs: Date.now() - start };
  } catch {
    return { status: "error", durationMs: Date.now() - start };
  }
}

function checkStorageConfig() {
  try {
    const env = getStorageEnv();
    return {
      status: env.S3_BUCKET ? "ok" : "missing_bucket",
      endpointConfigured: Boolean(env.AWS_ENDPOINT_URL_S3),
      region: env.AWS_REGION ?? "us-east-1",
    };
  } catch {
    return {
      status: "error",
      endpointConfigured: false,
      region: "unknown",
    };
  }
}

/**
 * Inspect internal app dependency readiness.
 * @response 200
 * @response 404
 * @response 503
 */
async function getRoute(request: Request) {
  if (!canReadReadiness(request)) {
    return new Response("Not found\n", { status: 404 });
  }

  const database = await checkDatabase();
  const storage = checkStorageConfig();
  const ready = database.status === "ok" && storage.status === "ok";

  return jsonResponse(
    {
      status: ready ? "ok" : "degraded",
      checks: {
        database,
        storage,
      },
      uptimeSeconds: Math.floor(process.uptime()),
    },
    { status: ready ? 200 : 503 },
  );
}

export const GET = observedApiRoute(getRoute);
