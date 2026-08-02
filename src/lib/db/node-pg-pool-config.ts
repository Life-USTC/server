import type { PoolConfig } from "pg";
import parseConnectionString from "pg-connection-string";

/**
 * Pool config for Node-side PrismaPg CLIs (static loader, maintenance crons).
 *
 * pg v8+ treats sslmode=require/prefer/verify-ca as verify-full unless libpq
 * compatibility is enabled. Production role URLs use sslmode=require with
 * self-signed certs; Prisma migrate tolerates them but node-pg rejects them.
 */
export function createNodePgPoolConfig(connectionString: string): PoolConfig {
  return parseConnectionString(connectionString, {
    useLibpqCompat: true,
  }) as PoolConfig;
}
