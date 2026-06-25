import { jsonResponse, notFoundText } from "@/lib/api/helpers";
import { svelteRequestHandler } from "@/lib/api/svelte-route";
import { prisma } from "@/lib/db/prisma";
import { canReadInternalEndpoint } from "@/lib/http/access-control";
import { observedApiRoute } from "@/lib/log/api-observability";
import { storageReadiness } from "@/lib/storage/r2-object";

const startedAt = Date.now();

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
  return storageReadiness();
}

async function getReadinessRoute(request: Request) {
  if (
    !canReadInternalEndpoint(request, [
      "READINESS_BEARER_TOKEN",
      "METRICS_BEARER_TOKEN",
    ])
  ) {
    return notFoundText();
  }

  const database = await checkDatabase();
  const storage = checkStorageConfig();
  const ready = database.status === "ok" && storage.status === "ok";

  return jsonResponse(
    {
      status: ready ? "ok" : "degraded",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      checks: {
        database,
        storage,
      },
    },
    { status: ready ? 200 : 503 },
  );
}

/**
 * Check internal dependency readiness.
 * @response readinessResponseSchema
 * @response 503:readinessResponseSchema
 * @response 404
 */
export const GET = svelteRequestHandler(observedApiRoute(getReadinessRoute));
