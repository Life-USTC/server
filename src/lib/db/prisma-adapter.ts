import { PrismaPg } from "@prisma/adapter-pg";
import { getOptionalTrimmedEnv } from "@/app-env";
import { logAppEvent } from "@/lib/log/app-logger";
import { env as privateEnv } from "$env/dynamic/private";

type RuntimeEnv = Record<string, unknown> & {
  HYPERDRIVE?: {
    connectionString?: unknown;
  };
};

function getRuntimeDatabaseUrl() {
  const hyperdriveConnectionString = (privateEnv as RuntimeEnv).HYPERDRIVE
    ?.connectionString;
  if (typeof hyperdriveConnectionString === "string") {
    return hyperdriveConnectionString.trim() || undefined;
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
        logAppEvent(
          "error",
          "Postgres connection error",
          { source: "prisma", event: "postgres.connection-error" },
          error,
        );
      },
      onPoolError: (error) => {
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
