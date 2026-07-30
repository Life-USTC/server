import { getOptionalTrimmedEnv } from "@/app-env";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  createPrismaAdapter,
  type RuntimeDatabase,
} from "@/lib/db/prisma-adapter";
import {
  getPrismaQueryDebugMode,
  getPrismaSlowQueryThresholdMs,
  shouldEnablePrismaQueryLogging,
} from "@/lib/db/prisma-query-logging";
import { logAppEvent } from "@/lib/log/app-logger";

const QUERY_LOG_TEXT_LIMIT = 2_000;

function compactQueryText(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= QUERY_LOG_TEXT_LIMIT) return compact;
  return `${compact.slice(0, QUERY_LOG_TEXT_LIMIT)}...`;
}

export function logPrismaQuery(event: Prisma.QueryEvent) {
  const slowThresholdMs = getPrismaSlowQueryThresholdMs();
  const debugMode = getPrismaQueryDebugMode();
  const isSlow = slowThresholdMs != null && event.duration >= slowThresholdMs;
  const shouldLogParams =
    debugMode === "verbose" &&
    getOptionalTrimmedEnv("NODE_ENV") !== "production";

  if (!isSlow && debugMode === "off") {
    return;
  }

  logAppEvent(isSlow ? "warn" : "info", "Prisma query timing", {
    source: "prisma",
    event: isSlow ? "prisma.slow-query" : "prisma.query",
    durationMs: event.duration,
    target: event.target,
    query: compactQueryText(event.query),
    ...(shouldLogParams ? { params: compactQueryText(event.params) } : {}),
  });
}

export function createBasePrisma(
  connectionString?: string,
  database: RuntimeDatabase = "app",
) {
  const adapter = createPrismaAdapter(connectionString, database);
  const options: Prisma.PrismaClientOptions = { adapter };
  if (database === "auth") {
    options.omit = { user: { calendarFeedToken: true } };
  }
  if (shouldEnablePrismaQueryLogging()) {
    options.log = [{ emit: "event", level: "query" }];
  }
  return new PrismaClient(options);
}
