import type { CloudflareAnalyticsReadPort } from "../ports/analytics";
import { getOptionalTrimmedEnv } from "./cloudflare-env";
import { getCloudflareRuntimeContext } from "./cloudflare-runtime";

export const CLOUDFLARE_ANALYTICS_DATASET = "life_ustc_runtime";
export const CLOUDFLARE_ANALYTICS_READ_CACHE_TTL_MS = 30_000;
const CLOUDFLARE_ANALYTICS_READ_CACHE_MAX_ENTRIES = 16;
const CLOUDFLARE_ANALYTICS_READ_MAX_IN_FLIGHT = 8;
const CLOUDFLARE_ANALYTICS_READ_TIMEOUT_MS = 5_000;
const ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/i;

type AnalyticsReadCacheEntry = {
  expiresAt: number;
  rows: readonly Record<string, unknown>[];
};

export class CloudflareAnalyticsReadUnavailableError extends Error {
  readonly reason: "not_configured" | "invalid_config";

  constructor(reason: "not_configured" | "invalid_config") {
    super(`Cloudflare Analytics Engine read is ${reason}`);
    this.name = "CloudflareAnalyticsReadUnavailableError";
    this.reason = reason;
  }
}

const cache = new Map<string, AnalyticsReadCacheEntry>();
const inFlight = new Map<string, Promise<readonly Record<string, unknown>[]>>();
const queryStateKey = Symbol("life-ustc.cloudflare.analytics-read");

type QueryState = {
  cache: Map<string, AnalyticsReadCacheEntry>;
  inFlight: Map<string, Promise<readonly Record<string, unknown>[]>>;
};

function getQueryState() {
  const runtimeContext = getCloudflareRuntimeContext();
  if (!runtimeContext) return { cache, inFlight };
  const existing = runtimeContext.cache.get(queryStateKey) as
    | QueryState
    | undefined;
  if (existing) return existing;
  const state: QueryState = {
    // Analytics rows are immutable values owned by this module. Sharing the
    // short-lived successful cache between requests is safe; sharing a
    // pending fetch Promise is not safe on Workers because its I/O belongs to
    // the request that started it.
    cache,
    inFlight: new Map(),
  };
  runtimeContext.cache.set(queryStateKey, state);
  return state;
}

function readAnalyticsConfig() {
  const accountId = getOptionalTrimmedEnv("CLOUDFLARE_ANALYTICS_ACCOUNT_ID");
  const apiToken = getOptionalTrimmedEnv("CLOUDFLARE_ANALYTICS_API_TOKEN");

  if (!accountId || !apiToken) return null;
  if (!ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new CloudflareAnalyticsReadUnavailableError("invalid_config");
  }

  return { accountId, apiToken };
}

function pruneCache(state: QueryState, now: number) {
  for (const [key, entry] of state.cache) {
    if (entry.expiresAt <= now) state.cache.delete(key);
  }
  while (state.cache.size >= CLOUDFLARE_ANALYTICS_READ_CACHE_MAX_ENTRIES) {
    const oldestKey = state.cache.keys().next().value;
    if (oldestKey === undefined) return;
    state.cache.delete(oldestKey);
  }
}

async function executeQuery(
  sql: string,
  config: { accountId: string; apiToken: string },
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    CLOUDFLARE_ANALYTICS_READ_TIMEOUT_MS,
  );
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/analytics_engine/sql`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: sql,
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(
        `Cloudflare Analytics Engine returned ${response.status}`,
      );
    }

    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== "object" ||
      !Array.isArray((payload as { data?: unknown }).data)
    ) {
      throw new Error("Cloudflare Analytics Engine returned invalid JSON");
    }
    const rows = (payload as { data: unknown[] }).data;
    if (
      rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))
    ) {
      throw new Error("Cloudflare Analytics Engine returned invalid rows");
    }
    return rows as Record<string, unknown>[];
  } finally {
    clearTimeout(timeout);
  }
}

async function query(sql: string) {
  const config = readAnalyticsConfig();
  if (!config) {
    throw new CloudflareAnalyticsReadUnavailableError("not_configured");
  }
  const state = getQueryState();
  // Keep account and token identity in the in-memory key so a credential
  // rotation cannot reuse a response. This value is never logged or returned.
  const cacheKey = `${config.accountId}\u0000${config.apiToken}\u0000${sql}`;
  const now = Date.now();
  const cached = state.cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.rows;
  if (cached) state.cache.delete(cacheKey);

  const pending = state.inFlight.get(cacheKey);
  if (pending) return pending;
  if (state.inFlight.size >= CLOUDFLARE_ANALYTICS_READ_MAX_IN_FLIGHT) {
    throw new Error("Cloudflare Analytics Engine read is busy");
  }

  const request = executeQuery(sql, config);
  state.inFlight.set(cacheKey, request);
  try {
    const rows = await request;
    pruneCache(state, Date.now());
    state.cache.set(cacheKey, {
      expiresAt: Date.now() + CLOUDFLARE_ANALYTICS_READ_CACHE_TTL_MS,
      rows,
    });
    return rows;
  } finally {
    state.inFlight.delete(cacheKey);
  }
}

export function getCloudflareAnalyticsReadPort(): CloudflareAnalyticsReadPort {
  return { query };
}

export function clearCloudflareAnalyticsReadCache() {
  cache.clear();
  inFlight.clear();
}
