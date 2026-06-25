const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const OPAQUE_ID_SEGMENT = /^(?=.*\d)[A-Za-z0-9_-]{16,}$/;
const CALENDAR_FEED_TOKEN_SEPARATOR = /:|%3a/i;
const OBSERVABILITY_PATHS = new Set(["/api/metrics"]);

export function shouldObserveApiPath(pathname: string) {
  return !OBSERVABILITY_PATHS.has(pathname);
}

export function normalizeApiRoutePath(pathname: string) {
  return pathname
    .split("/")
    .map((segment, index, segments) => {
      if (
        CALENDAR_FEED_TOKEN_SEPARATOR.test(segment) &&
        segments[index - 2] === "api" &&
        segments[index - 1] === "users" &&
        segments[index + 1] === "calendar.ics"
      ) {
        return ":id";
      }
      if (NUMERIC_SEGMENT.test(segment)) return ":id";
      if (UUID_SEGMENT.test(segment)) return ":id";
      if (OPAQUE_ID_SEGMENT.test(segment)) return ":id";
      return segment;
    })
    .join("/");
}
