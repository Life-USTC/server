import { PrismaPg } from "@prisma/adapter-pg";
import { getOptionalTrimmedEnv } from "@/app-env";
import {
  getCloudflareAuthHyperdriveConnectionString,
  getCloudflareHyperdriveConnectionString,
  hasCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { logAppEvent } from "@/lib/log/app-logger";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import { writeDatabaseEventAnalytics } from "@/lib/metrics/analytics-engine";

export type RuntimeDatabase = "app" | "auth";

function getRuntimeDatabaseUrl(database: RuntimeDatabase) {
  const hyperdriveConnectionString =
    database === "auth"
      ? getCloudflareAuthHyperdriveConnectionString()
      : getCloudflareHyperdriveConnectionString();
  if (hasCloudflareRuntimeEnv()) {
    if (!hyperdriveConnectionString) {
      const binding = database === "auth" ? "HYPERDRIVE_AUTH" : "HYPERDRIVE";
      throw new Error(
        `${binding} is required to initialize ${database} Prisma in Cloudflare runtime`,
      );
    }
    return hyperdriveConnectionString;
  }

  if (database === "auth") {
    const authDatabaseUrl = getOptionalTrimmedEnv("AUTH_DATABASE_URL");
    if (authDatabaseUrl) return authDatabaseUrl;
    if (getOptionalTrimmedEnv("NODE_ENV") === "production") return undefined;
    return getOptionalTrimmedEnv("DATABASE_URL");
  }
  return getOptionalTrimmedEnv("DATABASE_URL");
}

export function createPrismaAdapter(
  connectionString: string | undefined = undefined,
  database: RuntimeDatabase = "app",
) {
  const resolvedConnectionString =
    connectionString ?? getRuntimeDatabaseUrl(database);
  if (!resolvedConnectionString) {
    throw new Error(
      database === "auth"
        ? getOptionalTrimmedEnv("NODE_ENV") === "production"
          ? "AUTH_DATABASE_URL is required to initialize auth Prisma in production"
          : "AUTH_DATABASE_URL or DATABASE_URL is required to initialize auth Prisma"
        : "DATABASE_URL is required to initialize app Prisma",
    );
  }

  return new PrismaPg(
    {
      connectionString: resolvedConnectionString,
      // On Workers every request builds a fresh pool (pg sockets cannot be
      // reused across requests) and each new connection pays full SCRAM
      // deriveBits CPU. Concurrent queries (Promise.all, RLS tx + session
      // lookup) otherwise open up to pg's default of 10 connections per
      // request; cap the pool so a single request can never open more than 3.
      max: 3,
      // Idle connections from a finished request are never reusable, so close
      // them quickly instead of holding sockets (and server slots) for pg's
      // 10s default.
      idleTimeoutMillis: 5_000,
    },
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
