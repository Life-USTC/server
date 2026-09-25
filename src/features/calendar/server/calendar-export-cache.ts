import { enqueueUserCalendarExportRebuild } from "@/features/calendar/server/calendar-export-queue";
import { sha256Base64Url } from "@/lib/crypto/web-crypto";
import { writeCalendarFeedCacheAnalytics } from "@/lib/metrics/analytics-engine";
import { getCloudflareCalendarExportsNamespace } from "@/lib/ports/runtime";

const USER_CALENDAR_EXPORT_CACHE_VERSION = 2;
// Keep feeds "fresh" longer so calendar clients that poll often do not force a
// rebuild on every hit after 5 minutes. Writes still invalidate the cache.
export const USER_CALENDAR_EXPORT_FRESH_TTL_MS = 30 * 60_000;
export const USER_CALENDAR_EXPORT_STALE_TTL_MS = 24 * 60 * 60_000;
const USER_CALENDAR_EXPORT_KV_CACHE_TTL_SECONDS = 60;
const USER_CALENDAR_EXPORT_REVALIDATE_TTL_MS =
  USER_CALENDAR_EXPORT_KV_CACHE_TTL_SECONDS * 1_000;
const USER_CALENDAR_EXPORT_KV_EXPIRATION_TTL_SECONDS =
  USER_CALENDAR_EXPORT_STALE_TTL_MS / 1_000;
const MAX_USER_CALENDAR_EXPORT_CACHE_ENTRIES = 100;

export type UserCalendarExportCacheStatus = "fresh" | "miss" | "stale";

type UserCalendarExport = {
  cacheControl: string;
  filename: string;
  text: string;
};

export type UserCalendarExportWithEtag = UserCalendarExport & {
  etag: string;
};

type StoredUserCalendarExport = UserCalendarExportWithEtag & {
  generatedAtMs: number;
  version: typeof USER_CALENDAR_EXPORT_CACHE_VERSION;
};

type UserCalendarExportCacheOptions = {
  defer?: (promise: Promise<unknown>) => void;
};

type MemoryUserCalendarExport = {
  calendar: StoredUserCalendarExport;
  revalidateAtMs: number;
  rebuildAfterMs: number;
};

const userCalendarExportCache = new Map<string, MemoryUserCalendarExport>();
const userCalendarExportRefreshes = new Map<
  string,
  Promise<UserCalendarExportWithEtag | null>
>();

function cacheKey(userId: string) {
  return `user-calendar:v${USER_CALENDAR_EXPORT_CACHE_VERSION}:${userId}`;
}

function isStoredUserCalendarExport(
  value: unknown,
): value is StoredUserCalendarExport {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<StoredUserCalendarExport>;
  return (
    entry.version === USER_CALENDAR_EXPORT_CACHE_VERSION &&
    typeof entry.generatedAtMs === "number" &&
    Number.isFinite(entry.generatedAtMs) &&
    typeof entry.cacheControl === "string" &&
    typeof entry.etag === "string" &&
    typeof entry.filename === "string" &&
    typeof entry.text === "string"
  );
}

function pruneExpiredEntries(nowMs: number) {
  for (const [key, entry] of userCalendarExportCache) {
    if (
      nowMs - entry.calendar.generatedAtMs >
      USER_CALENDAR_EXPORT_STALE_TTL_MS
    ) {
      userCalendarExportCache.delete(key);
    }
  }
}

function pruneOldestEntries() {
  while (
    userCalendarExportCache.size > MAX_USER_CALENDAR_EXPORT_CACHE_ENTRIES
  ) {
    const oldestKey = userCalendarExportCache.keys().next().value;
    if (!oldestKey) return;
    userCalendarExportCache.delete(oldestKey);
  }
}

function recordCalendarFeedCacheStatus(
  status:
    | UserCalendarExportCacheStatus
    | "refresh_error"
    | "refresh_success"
    | "store_error",
) {
  writeCalendarFeedCacheAnalytics({
    feed: "user",
    status,
    storeSize: userCalendarExportCache.size,
    ttlMs: USER_CALENDAR_EXPORT_FRESH_TTL_MS,
  });
}

export async function createCalendarEtag(text: string) {
  return `"sha256-${await sha256Base64Url(text)}"`;
}

export function requestMatchesEtag(request: Request, etag: string) {
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (!ifNoneMatch) return false;

  return ifNoneMatch.split(",").some((token) => {
    const normalized = token.trim().replace(/^W\//, "");
    return normalized === "*" || normalized === etag;
  });
}

async function readStoredCalendar(userId: string) {
  const memoryEntry = userCalendarExportCache.get(userId);
  if (memoryEntry && Date.now() < memoryEntry.revalidateAtMs) {
    return memoryEntry.calendar;
  }

  const namespace = getCloudflareCalendarExportsNamespace();
  if (!namespace) return memoryEntry?.calendar ?? null;

  try {
    const entry = await namespace.get<StoredUserCalendarExport>(
      cacheKey(userId),
      {
        cacheTtl: USER_CALENDAR_EXPORT_KV_CACHE_TTL_SECONDS,
        type: "json",
      },
    );
    // Invalidation or a completed rebuild may replace this entry while KV is
    // pending. Its result must not restore deleted data or overwrite that write.
    const current = userCalendarExportCache.get(userId);
    if (current !== memoryEntry) return current?.calendar ?? null;
    if (!isStoredUserCalendarExport(entry)) {
      userCalendarExportCache.delete(userId);
      return null;
    }
    // A queue consumer updates its own isolate and KV, not the serving isolate.
    // Revalidate even fresh exports, and retain the local enqueue cooldown when
    // concurrent readers see the same (possibly not yet propagated) KV value.
    const calendar =
      current && current.calendar.generatedAtMs > entry.generatedAtMs
        ? current.calendar
        : entry;
    if (current) {
      current.calendar = calendar;
      current.revalidateAtMs =
        Date.now() + USER_CALENDAR_EXPORT_REVALIDATE_TTL_MS;
    } else {
      userCalendarExportCache.set(userId, {
        calendar,
        revalidateAtMs: Date.now() + USER_CALENDAR_EXPORT_REVALIDATE_TTL_MS,
        rebuildAfterMs: 0,
      });
    }
    pruneOldestEntries();
    return calendar;
  } catch {
    recordCalendarFeedCacheStatus("store_error");
    return userCalendarExportCache.get(userId)?.calendar ?? null;
  }
}

async function persistStoredCalendar(
  userId: string,
  entry: StoredUserCalendarExport,
) {
  const namespace = getCloudflareCalendarExportsNamespace();
  if (!namespace) return true;

  try {
    await namespace.put(cacheKey(userId), JSON.stringify(entry), {
      expirationTtl: USER_CALENDAR_EXPORT_KV_EXPIRATION_TTL_SECONDS,
    });
    return true;
  } catch {
    recordCalendarFeedCacheStatus("store_error");
    return false;
  }
}

/**
 * Persist a built ICS export to isolate memory + KV (queue rebuild / sync miss).
 */
export async function storeBuiltUserCalendarExport(
  userId: string,
  calendar: UserCalendarExport,
  options: UserCalendarExportCacheOptions = {},
) {
  const stored: StoredUserCalendarExport = {
    ...calendar,
    etag: await createCalendarEtag(calendar.text),
    generatedAtMs: Date.now(),
    version: USER_CALENDAR_EXPORT_CACHE_VERSION,
  };
  userCalendarExportCache.set(userId, {
    calendar: stored,
    revalidateAtMs: Date.now() + USER_CALENDAR_EXPORT_REVALIDATE_TTL_MS,
    rebuildAfterMs: 0,
  });
  pruneOldestEntries();
  const persistence = persistStoredCalendar(userId, stored);
  if (options.defer) {
    const deferredPersistence = persistence.then((persisted) => {
      if (!persisted) {
        throw new Error("Calendar export cache persistence failed");
      }
      recordCalendarFeedCacheStatus("refresh_success");
    });
    options.defer(deferredPersistence);
  } else {
    if (!(await persistence)) {
      throw new Error("Calendar export cache persistence failed");
    }
    recordCalendarFeedCacheStatus("refresh_success");
  }
  return stored;
}

function refreshUserCalendarExport(
  userId: string,
  buildExport: () => Promise<UserCalendarExport | null>,
  defer?: (promise: Promise<unknown>) => void,
) {
  const pending = userCalendarExportRefreshes.get(userId);
  if (pending) return pending;

  const refresh = (async () => {
    let calendar: UserCalendarExport | null;
    try {
      calendar = await buildExport();
    } catch (error) {
      recordCalendarFeedCacheStatus("refresh_error");
      throw error;
    }
    if (!calendar) return null;
    return storeBuiltUserCalendarExport(userId, calendar, { defer });
  })();

  userCalendarExportRefreshes.set(userId, refresh);
  void refresh.then(
    () => userCalendarExportRefreshes.delete(userId),
    () => userCalendarExportRefreshes.delete(userId),
  );
  return refresh;
}

function scheduleStaleCalendarExportRebuild(
  userId: string,
  defer?: (promise: Promise<unknown>) => void,
) {
  const memoryEntry = userCalendarExportCache.get(userId);
  const nowMs = Date.now();
  if (memoryEntry && nowMs < memoryEntry.rebuildAfterMs) return;
  const rebuildAfterMs = nowMs + USER_CALENDAR_EXPORT_REVALIDATE_TTL_MS;
  if (memoryEntry) memoryEntry.rebuildAfterMs = rebuildAfterMs;
  const enqueue = enqueueUserCalendarExportRebuild(userId).catch((error) => {
    // A failed send must not suppress the next poll's retry. Do not clear a
    // newer request's cooldown if an earlier slow enqueue fails later.
    if (memoryEntry?.rebuildAfterMs === rebuildAfterMs) {
      memoryEntry.rebuildAfterMs = 0;
    }
    throw error;
  });
  if (defer) {
    try {
      defer(enqueue);
      return;
    } catch {
      // A failed scheduler must not turn a stale response into an error.
    }
  }

  enqueue.catch(() => {
    // The enqueue helper records a low-cardinality failure metric. Keep this
    // no-defer path non-blocking without leaving an unhandled rejection.
  });
}

export async function getCachedUserCalendarExport(
  userId: string,
  buildExport: () => Promise<UserCalendarExport | null>,
  options: UserCalendarExportCacheOptions = {},
) {
  const nowMs = Date.now();
  pruneExpiredEntries(nowMs);

  const cached = await readStoredCalendar(userId);
  if (cached) {
    const ageMs = Math.max(0, nowMs - cached.generatedAtMs);
    if (ageMs <= USER_CALENDAR_EXPORT_FRESH_TTL_MS) {
      recordCalendarFeedCacheStatus("fresh");
      return {
        calendar: cached,
        status: "fresh" satisfies UserCalendarExportCacheStatus,
      };
    }

    if (ageMs <= USER_CALENDAR_EXPORT_STALE_TTL_MS) {
      // Serve stale immediately and enqueue a Queue rebuild. Do not rebuild ICS
      // on the request path (or inside waitUntil) — that path hit cpu_ms / cancel.
      scheduleStaleCalendarExportRebuild(userId, options.defer);
      recordCalendarFeedCacheStatus("stale");
      return {
        calendar: cached,
        status: "stale" satisfies UserCalendarExportCacheStatus,
      };
    }

    userCalendarExportCache.delete(userId);
  }

  recordCalendarFeedCacheStatus("miss");
  const calendar = await refreshUserCalendarExport(
    userId,
    buildExport,
    options.defer,
  );
  return {
    calendar,
    status: "miss" satisfies UserCalendarExportCacheStatus,
  };
}

export function resetUserCalendarExportCacheForTest() {
  userCalendarExportCache.clear();
  userCalendarExportRefreshes.clear();
}

export async function invalidateUserCalendarExportCache(userId: string) {
  userCalendarExportCache.delete(userId);
  userCalendarExportRefreshes.delete(userId);

  const namespace = getCloudflareCalendarExportsNamespace();
  if (!namespace) return;

  try {
    await namespace.delete(cacheKey(userId));
  } catch {
    recordCalendarFeedCacheStatus("store_error");
  }
}
