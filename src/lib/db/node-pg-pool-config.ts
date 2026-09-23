import type { PoolConfig } from "pg";
import { parse as parseConnectionString } from "pg-connection-string";

/**
 * pg defaults `connectionTimeoutMillis` to "wait forever". A Postgres instance
 * that accepts TCP but cannot make progress — the disk-full (`53100`) mode we
 * hit in production — then parks the loader on an await that never settles, so
 * an ingestion run hangs instead of failing. The Worker pools bound this in
 * `prisma-adapter.ts`; the Node-side CLIs need the same floor.
 *
 * Deliberately no `query_timeout` here: unlike a page render, a bulk ingestion
 * statement can legitimately run for minutes, and capping it would turn slow
 * loads into corrupt partial ones.
 */
export const NODE_PG_CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Pool config for Node-side PrismaPg CLIs such as the static loader.
 *
 * pg v8+ treats sslmode=require/prefer/verify-ca as verify-full unless libpq
 * compatibility is enabled. Production role URLs use sslmode=require with
 * self-signed certs; Prisma migrate tolerates them but node-pg rejects them.
 */
export function createNodePgPoolConfig(connectionString: string): PoolConfig {
  const parsed = parseConnectionString(connectionString, {
    useLibpqCompat: true,
  }) as PoolConfig;

  return {
    ...parsed,
    connectionTimeoutMillis: NODE_PG_CONNECTION_TIMEOUT_MS,
  };
}
