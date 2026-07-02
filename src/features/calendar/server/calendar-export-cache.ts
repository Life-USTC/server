import { sha256Base64Url } from "@/lib/crypto/web-crypto";
import { writeCalendarFeedCacheAnalytics } from "@/lib/metrics/analytics-engine";

const USER_CALENDAR_EXPORT_CACHE_TTL_MS = 60_000;
const MAX_USER_CALENDAR_EXPORT_CACHE_ENTRIES = 100;

export type UserCalendarExportCacheStatus = "hit" | "miss";

type UserCalendarExport = {
  cacheControl: string;
  filename: string;
  text: string;
};

export type UserCalendarExportWithEtag = UserCalendarExport & {
  etag: string;
};

type CacheEntry = {
  calendar: UserCalendarExportWithEtag;
  expiresAtMs: number;
};

const userCalendarExportCache = new Map<string, CacheEntry>();

function pruneExpiredEntries(nowMs: number) {
  for (const [key, entry] of userCalendarExportCache) {
    if (entry.expiresAtMs <= nowMs) {
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

function recordCalendarFeedCacheStatus(status: UserCalendarExportCacheStatus) {
  writeCalendarFeedCacheAnalytics({
    feed: "user",
    status,
    storeSize: userCalendarExportCache.size,
    ttlMs: USER_CALENDAR_EXPORT_CACHE_TTL_MS,
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

export async function getCachedUserCalendarExport(
  userId: string,
  buildExport: () => Promise<UserCalendarExport | null>,
) {
  const nowMs = Date.now();
  pruneExpiredEntries(nowMs);

  const cached = userCalendarExportCache.get(userId);
  if (cached && cached.expiresAtMs > nowMs) {
    recordCalendarFeedCacheStatus("hit");
    return {
      calendar: cached.calendar,
      status: "hit" satisfies UserCalendarExportCacheStatus,
    };
  }

  if (cached) {
    userCalendarExportCache.delete(userId);
  }

  const calendar = await buildExport();
  if (!calendar) {
    recordCalendarFeedCacheStatus("miss");
    return {
      calendar: null,
      status: "miss" satisfies UserCalendarExportCacheStatus,
    };
  }

  const calendarWithEtag = {
    ...calendar,
    etag: await createCalendarEtag(calendar.text),
  };
  userCalendarExportCache.set(userId, {
    calendar: calendarWithEtag,
    expiresAtMs: nowMs + USER_CALENDAR_EXPORT_CACHE_TTL_MS,
  });
  pruneOldestEntries();

  recordCalendarFeedCacheStatus("miss");
  return {
    calendar: calendarWithEtag,
    status: "miss" satisfies UserCalendarExportCacheStatus,
  };
}

export function resetUserCalendarExportCacheForTest() {
  userCalendarExportCache.clear();
}
