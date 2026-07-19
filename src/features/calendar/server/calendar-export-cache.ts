import { getCloudflareCalendarExportsNamespace } from "@/lib/adapters/cloudflare-runtime";
import { sha256Base64Url } from "@/lib/crypto/web-crypto";
import { writeCalendarFeedCacheAnalytics } from "@/lib/metrics/analytics-engine";

const USER_CALENDAR_EXPORT_CACHE_VERSION = 1;
export const USER_CALENDAR_EXPORT_FRESH_TTL_MS = 5 * 60_000;
export const USER_CALENDAR_EXPORT_STALE_TTL_MS = 24 * 60 * 60_000;
const USER_CALENDAR_EXPORT_KV_CACHE_TTL_SECONDS = 30;
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

const userCalendarExportCache = new Map<string, StoredUserCalendarExport>();
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
    if (nowMs - entry.generatedAtMs > USER_CALENDAR_EXPORT_STALE_TTL_MS) {
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
  if (memoryEntry) return memoryEntry;

  const namespace = getCloudflareCalendarExportsNamespace();
  if (!namespace) return null;

  try {
    const entry = await namespace.get<StoredUserCalendarExport>(
      cacheKey(userId),
      {
        cacheTtl: USER_CALENDAR_EXPORT_KV_CACHE_TTL_SECONDS,
        type: "json",
      },
    );
    if (!isStoredUserCalendarExport(entry)) return null;
    userCalendarExportCache.set(userId, entry);
    pruneOldestEntries();
    return entry;
  } catch {
    recordCalendarFeedCacheStatus("store_error");
    return null;
  }
}

async function persistStoredCalendar(
  userId: string,
  entry: StoredUserCalendarExport,
) {
  const namespace = getCloudflareCalendarExportsNamespace();
  if (!namespace) return;

  try {
    await namespace.put(cacheKey(userId), JSON.stringify(entry), {
      expirationTtl: USER_CALENDAR_EXPORT_KV_EXPIRATION_TTL_SECONDS,
    });
  } catch {
    recordCalendarFeedCacheStatus("store_error");
  }
}

function refreshUserCalendarExport(
  userId: string,
  buildExport: () => Promise<UserCalendarExport | null>,
  defer?: (promise: Promise<unknown>) => void,
) {
  const pending = userCalendarExportRefreshes.get(userId);
  if (pending) return pending;

  const refresh = (async () => {
    const calendar = await buildExport();
    if (!calendar) return null;

    const stored: StoredUserCalendarExport = {
      ...calendar,
      etag: await createCalendarEtag(calendar.text),
      generatedAtMs: Date.now(),
      version: USER_CALENDAR_EXPORT_CACHE_VERSION,
    };
    userCalendarExportCache.set(userId, stored);
    pruneOldestEntries();
    const persistence = persistStoredCalendar(userId, stored);
    if (defer) {
      defer(persistence);
    } else {
      await persistence;
    }
    recordCalendarFeedCacheStatus("refresh_success");
    return stored;
  })();

  userCalendarExportRefreshes.set(userId, refresh);
  void refresh.then(
    () => userCalendarExportRefreshes.delete(userId),
    () => userCalendarExportRefreshes.delete(userId),
  );
  return refresh;
}

function backgroundRefresh(
  refresh: Promise<UserCalendarExportWithEtag | null>,
) {
  return refresh.then(
    () => undefined,
    () => {
      recordCalendarFeedCacheStatus("refresh_error");
    },
  );
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
      const refresh = refreshUserCalendarExport(userId, buildExport);
      if (options.defer) {
        options.defer(backgroundRefresh(refresh));
        recordCalendarFeedCacheStatus("stale");
        return {
          calendar: cached,
          status: "stale" satisfies UserCalendarExportCacheStatus,
        };
      }

      try {
        const refreshed = await refresh;
        if (refreshed) {
          return {
            calendar: refreshed,
            status: "miss" satisfies UserCalendarExportCacheStatus,
          };
        }
      } catch {
        recordCalendarFeedCacheStatus("refresh_error");
      }

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
