/** Server attestation: every returned layout/page node is a public projection. */
export const PUBLIC_NAVIGATION_HEADER = "x-life-public-navigation";

const PUBLIC_PATHS = new Set([
  "/catalog/features",
  "/catalog/courses",
  "/catalog/sections",
  "/catalog/teachers",
  "/catalog/links",
  "/catalog/rooms",
  "/search",
  "/news",
  "/news/sources",
  "/privacy",
  "/terms",
  "/guides/markdown-support",
  "/api-docs",
  "/api/docs",
  "/usage/mobile",
  "/usage/bot",
  "/usage/mcp",
  "/usage/cli",
  "/community/comments/guide",
]);

/** Keep this list limited to routes whose loaders contain no viewer data. */
export function isPublicNavigationPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    /^\/catalog\/(?:courses|sections|teachers)\/[1-9]\d*$/.test(pathname) ||
    /^\/catalog\/young-events(?:\/(?:organizers(?:\/[^/]+)?|[^/]+))?$/.test(
      pathname,
    ) ||
    /^\/news\/[^/]+$/.test(pathname) ||
    /^\/community\/users\/[^/]+$/.test(pathname) ||
    pathname.startsWith("/api/docs/")
  );
}

/** Redirects and load errors use HTTP 200 too; only complete data is reusable. */
export function isSuccessfulPublicNavigationData(value: unknown) {
  if (typeof value !== "object" || value === null) return false;
  if (!("type" in value) || value.type !== "data") return false;
  if (!("nodes" in value) || !Array.isArray(value.nodes)) return false;
  return value.nodes.every(
    (node: unknown) =>
      node === null ||
      (typeof node === "object" &&
        "type" in node &&
        (node.type === "skip" ||
          (node.type === "data" &&
            "data" in node &&
            Array.isArray(node.data)))),
  );
}
