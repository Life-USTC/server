import { PrismaPg } from "@prisma/adapter-pg";
import { getOptionalTrimmedEnv } from "@/app-env";
import { logAppEvent } from "@/lib/log/app-logger";

export function createPrismaAdapter(
  connectionString = getOptionalTrimmedEnv("DATABASE_URL"),
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
