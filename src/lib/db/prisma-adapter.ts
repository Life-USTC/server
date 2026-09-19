import { PrismaPg } from "@prisma/adapter-pg";
import { getOptionalTrimmedEnv } from "@/app-env";
import {
  getCloudflareAuthHyperdriveConnectionString,
  getCloudflareHyperdriveConnectionString,
  getCloudflareMaintenanceHyperdriveConnectionString,
  hasCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { logAppEvent } from "@/lib/log/app-logger";
import { getSafeErrorName } from "@/lib/log/safe-error-name";
import { writeDatabaseEventAnalytics } from "@/lib/metrics/analytics-engine";

export type RuntimeDatabase = "app" | "auth" | "maintenance";

/**
 * pg defaults `connectionTimeoutMillis` and `query_timeout` to "wait forever".
 * A Postgres instance that accepts TCP connections but cannot make progress —
 * the disk-full (`53100`) mode we hit in production — then parks the Worker on
 * an await that never settles, and the runtime cancels the invocation with
 * "your Worker's code had hung and would never generate a response" instead of
 * returning an error page. Bounding both waits turns that hang into a normal
 * failed query the request can surface.
 */
export const RUNTIME_DATABASE_CONNECTION_TIMEOUT_MS = 5_000;
export const RUNTIME_DATABASE_QUERY_TIMEOUT_MS = 15_000;
/** Retention/cleanup crons legitimately run longer than a page render. */
export const MAINTENANCE_DATABASE_CONNECTION_TIMEOUT_MS = 10_000;
export const MAINTENANCE_DATABASE_QUERY_TIMEOUT_MS = 60_000;

export function resolveDatabaseTimeouts(database: RuntimeDatabase) {
  return database === "maintenance"
    ? {
        connectionTimeoutMillis: MAINTENANCE_DATABASE_CONNECTION_TIMEOUT_MS,
        query_timeout: MAINTENANCE_DATABASE_QUERY_TIMEOUT_MS,
      }
    : {
        connectionTimeoutMillis: RUNTIME_DATABASE_CONNECTION_TIMEOUT_MS,
        query_timeout: RUNTIME_DATABASE_QUERY_TIMEOUT_MS,
      };
}

function getRuntimeDatabaseUrl(database: RuntimeDatabase) {
  const hyperdriveConnectionString =
    database === "auth"
      ? getCloudflareAuthHyperdriveConnectionString()
      : database === "maintenance"
        ? getCloudflareMaintenanceHyperdriveConnectionString()
        : getCloudflareHyperdriveConnectionString();
  if (hasCloudflareRuntimeEnv()) {
    if (!hyperdriveConnectionString) {
      const binding =
        database === "auth"
          ? "HYPERDRIVE_AUTH"
          : database === "maintenance"
            ? "HYPERDRIVE_MAINTENANCE"
            : "HYPERDRIVE";
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
  if (database === "maintenance") {
    const maintenanceDatabaseUrl = getOptionalTrimmedEnv(
      "MAINTENANCE_DATABASE_URL",
    );
    if (maintenanceDatabaseUrl) return maintenanceDatabaseUrl;
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
    if (database === "auth") {
      throw new Error(
        getOptionalTrimmedEnv("NODE_ENV") === "production"
          ? "AUTH_DATABASE_URL is required to initialize auth Prisma in production"
          : "AUTH_DATABASE_URL or DATABASE_URL is required to initialize auth Prisma",
      );
    }
    if (database === "maintenance") {
      throw new Error(
        getOptionalTrimmedEnv("NODE_ENV") === "production"
          ? "MAINTENANCE_DATABASE_URL is required to initialize maintenance Prisma in production"
          : "MAINTENANCE_DATABASE_URL or DATABASE_URL is required to initialize maintenance Prisma",
      );
    }
    throw new Error("DATABASE_URL is required to initialize app Prisma");
  }

  return new PrismaPg(
    {
      connectionString: resolvedConnectionString,
      // On Workers every request builds a fresh pool (pg sockets cannot be
      // reused across requests), which the runtime context disconnects before
      // the request completes. Concurrent queries (Promise.all, RLS tx +
      // session lookup) otherwise open up to pg's default of 10 connections;
      // cap the pool so a single request can never open more than 3.
      max: 3,
      // Keep a short idle timeout as a safety net for clients created outside
      // the managed request context.
      idleTimeoutMillis: 5_000,
      // Never wait indefinitely on a wedged database; see the timeout constants.
      ...resolveDatabaseTimeouts(database),
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
