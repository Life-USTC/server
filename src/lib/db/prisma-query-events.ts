import { getOptionalTrimmedEnv } from "@/app-env";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db/prisma-adapter";
import {
  getPrismaQueryDebugMode,
  getPrismaSlowQueryThresholdMs,
  shouldEnablePrismaQueryLogging,
} from "@/lib/db/prisma-query-logging";
import { shouldLog } from "@/lib/log/app-logger";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";

const QUERY_LOG_TEXT_LIMIT = 2_000;

function compactQueryText(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= QUERY_LOG_TEXT_LIMIT) return compact;
  return `${compact.slice(0, QUERY_LOG_TEXT_LIMIT)}...`;
}

function logPrismaQueryEvent(
  level: "info" | "warn",
  message: string,
  context: Record<string, unknown>,
) {
  if (!shouldLog(level)) return;

  const environment = getOptionalTrimmedEnv("NODE_ENV") ?? "development";
  const payload = {
    timestamp: formatShanghaiTimestamp(new Date()),
    environment,
    runtime: typeof window === "undefined" ? "server" : "client",
    message,
    ...context,
  };
  const method = level === "warn" ? console.warn : console.info;

  if (environment === "production") {
    method(JSON.stringify({ prefix: "[app]", ...payload }));
    return;
  }

  method("[app]", payload);
}

export function logPrismaQuery(event: Prisma.QueryEvent) {
  const slowThresholdMs = getPrismaSlowQueryThresholdMs();
  const debugMode = getPrismaQueryDebugMode();
  const isSlow = slowThresholdMs != null && event.duration >= slowThresholdMs;

  if (!isSlow && debugMode === "off") {
    return;
  }

  logPrismaQueryEvent(isSlow ? "warn" : "info", "Prisma query timing", {
    source: "prisma",
    event: isSlow ? "prisma.slow-query" : "prisma.query",
    durationMs: event.duration,
    target: event.target,
    query: compactQueryText(event.query),
    ...(debugMode === "verbose"
      ? { params: compactQueryText(event.params) }
      : {}),
  });
}

export function createBasePrisma() {
  const adapter = createPrismaAdapter();
  if (!shouldEnablePrismaQueryLogging()) {
    return new PrismaClient({ adapter });
  }

  return new PrismaClient({
    adapter,
    log: [{ emit: "event", level: "query" }],
  });
}
