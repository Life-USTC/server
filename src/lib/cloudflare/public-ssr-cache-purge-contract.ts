/**
 * Wire contract for the internal Workers-cache purge endpoint.
 *
 * The static loader runs as a Node/Bun CLI in a Docker image that only copies
 * `src/static-loader` plus a few explicitly listed leaf modules (see
 * `Dockerfile`), and the `@/` path alias does not resolve there. Keep this
 * module free of imports so both the Worker handler and the loader client can
 * share one definition through a relative import instead of drifting copies.
 */

/** Internal, non-public route. `/_internal` never enters the public SSR cache. */
export const PUBLIC_SSR_CACHE_PURGE_PATH = "/_internal/edge-cache/purge";

/** Shared-secret header, mirroring `X-Publication-Ingestion-Secret`. */
export const PUBLIC_SSR_CACHE_PURGE_SECRET_HEADER = "X-Edge-Cache-Purge-Secret";

/** Worker secret holding the expected value of the header above. */
export const PUBLIC_SSR_CACHE_PURGE_SECRET_ENV = "EDGE_CACHE_PURGE_SECRET";

/** Origin the loader posts to; already configured for the Worker itself. */
export const PUBLIC_SSR_CACHE_PURGE_ORIGIN_ENV = "APP_PUBLIC_ORIGIN";
