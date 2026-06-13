import { getStorageEnv } from "@/app-env";
import { canReadInternalEndpoint } from "@/lib/http/access-control";
import { jsonResponse, notFoundText } from "@/lib/http/responses";

async function checkDatabase() {
  const start = Date.now();
  try {
    const { prisma } = await import("@/lib/db/prisma");
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

export async function GET({ request }: { request: Request }) {
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
      checks: {
        database,
        storage,
      },
    },
    { status: ready ? 200 : 503 },
  );
}
