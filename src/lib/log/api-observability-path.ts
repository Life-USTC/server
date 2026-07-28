const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const OPAQUE_ID_SEGMENT = /^(?=.*\d)[A-Za-z0-9_-]{16,}$/;

export function normalizeApiRoutePath(pathname: string) {
  return pathname
    .split("/")
    .map((segment, index, segments) => {
      if (
        segments[index - 2] === "api" &&
        segments[index - 1] === "users" &&
        segments[index + 1] === "calendar.ics"
      ) {
        return ":credential";
      }
      if (
        segments[index - 2] === "api" &&
        segments[index - 1] === "calendar-feeds"
      ) {
        return ":credential.ics";
      }
      if (NUMERIC_SEGMENT.test(segment)) return ":id";
      if (UUID_SEGMENT.test(segment)) return ":id";
      if (OPAQUE_ID_SEGMENT.test(segment)) return ":id";
      return segment;
    })
    .join("/");
}
