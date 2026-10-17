/**
 * Minimal surface of the `cloudflare:workers` runtime module used by
 * src/hooks.server.ts. `wrangler types --include-runtime=false` does not
 * generate runtime module declarations, and including the full
 * `@cloudflare/workers-types` globals would conflict with the DOM lib.
 */
declare module "cloudflare:workers" {
  export const env: unknown;
  export function waitUntil(promise: Promise<unknown>): void;
  export const exports: unknown;
  export const tracing: unknown;
}
