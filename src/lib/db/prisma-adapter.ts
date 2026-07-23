import { PrismaPg } from "@prisma/adapter-pg";
import { getOptionalTrimmedEnv } from "@/app-env";
import {
  getCloudflareHyperdriveConnectionString,
  hasCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { logAppEvent } from "@/lib/log/app-logger";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import { writeDatabaseEventAnalytics } from "@/lib/metrics/analytics-engine";

function getRuntimeDatabaseUrl() {
  const hyperdriveConnectionString = getCloudflareHyperdriveConnectionString();
  if (hasCloudflareRuntimeEnv()) {
    if (!hyperdriveConnectionString) {
      throw new Error(
        "HYPERDRIVE is required to initialize Prisma in Cloudflare runtime",
      );
    }
    return hyperdriveConnectionString;
  }

  return getOptionalTrimmedEnv("DATABASE_URL");
}

export function createPrismaAdapter(
  connectionString = getRuntimeDatabaseUrl(),
) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma");
  }

  return new PrismaPg(
    { connectionString },
    {
      onConnectionError: (error) => {
        writeDatabaseEventAnalytics({
          errorName: getSafeErrorName(error),
          event: "connection_error",
        });
        logAppEvent(
          "error",
          "Postgres connection error",
          { source: "prisma", event: "postgres.connection-error" },
          error,
        );
      },
      onPoolError: (error) => {
        writeDatabaseEventAnalytics({
          errorName: getSafeErrorName(error),
          event: "pool_error",
        });
        logAppEvent(
          "error",
          "Postgres pool error",
          { source: "prisma", event: "postgres.pool-error" },
          error,
        );
      },
    },
  );
}
