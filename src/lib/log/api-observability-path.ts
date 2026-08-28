const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const OPAQUE_ID_SEGMENT = /^(?=.*\d)[A-Za-z0-9_-]{16,}$/;

export const API_ROUTE_FAMILY_NAMES = [
  "account",
  "admin",
  "auth",
  "calendar-feeds",
  "catalog",
  "community",
  "graphql",
  "health",
  "mcp",
  "openapi",
  "search",
  "users",
  "workspace",
] as const;

export type ApiRouteFamily = (typeof API_ROUTE_FAMILY_NAMES)[number] | "other";

const API_ROUTE_FAMILY_SET = new Set<string>(API_ROUTE_FAMILY_NAMES);

export function resolveApiRouteFamily(pathname: string): ApiRouteFamily {
  const path = pathname.split(/[?#]/, 1)[0] ?? pathname;
  const segment = path.startsWith("/api/") ? path.split("/", 3)[2] : undefined;
  return segment && API_ROUTE_FAMILY_SET.has(segment)
    ? (segment as ApiRouteFamily)
    : "other";
}

export function normalizeApiRouteFamilyPath(pathname: string) {
  return `/api/${resolveApiRouteFamily(pathname)}`;
}

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
