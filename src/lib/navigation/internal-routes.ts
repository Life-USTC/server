/**
 * Canonical paths of the same-origin `/_internal/*` viewer endpoints.
 *
 * These endpoints carry session-dependent or clock-dependent data for pages
 * whose HTML is public and shared-cacheable. Clients and route files both derive their paths from
 * here; `tests/unit/lib/navigation/internal-routes.test.ts` verifies each path
 * resolves to a route file and to the public page it supplements, so renaming
 * a public route cannot silently orphan its viewer endpoint.
 */
export const INTERNAL_ROUTE_PREFIX = "/_internal";

export const SHELL_BOOTSTRAP_PATH = `${INTERNAL_ROUTE_PREFIX}/shell-bootstrap`;

/** Supplements public `/`, whose cached HTML omits the minute-by-minute board. */
export const HOME_CAMPUS_NOW_PATH = `${INTERNAL_ROUTE_PREFIX}/home/campus-now`;

/** Supplements public `/catalog/links`. */
export const CATALOG_LINKS_VIEWER_PATH = `${INTERNAL_ROUTE_PREFIX}/catalog/links/viewer`;

/** Supplements public `/catalog/sections/[jwId]`. */
export function sectionViewerPath(jwId: number | string) {
  return `${INTERNAL_ROUTE_PREFIX}/catalog/sections/${jwId}/viewer`;
}

/** Internal viewer endpoint and the public page whose personal overlay it feeds. */
export const INTERNAL_VIEWER_ROUTES = [
  {
    internal: HOME_CAMPUS_NOW_PATH,
    publicPage: "/",
  },
  {
    internal: CATALOG_LINKS_VIEWER_PATH,
    publicPage: "/catalog/links",
  },
  {
    internal: sectionViewerPath("[jwId]"),
    publicPage: "/catalog/sections/[jwId]",
  },
] as const;
