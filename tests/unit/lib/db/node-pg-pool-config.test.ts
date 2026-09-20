import { describe, expect, it } from "vitest";
import {
  createNodePgPoolConfig,
  NODE_PG_CONNECTION_TIMEOUT_MS,
} from "@/lib/db/node-pg-pool-config";

describe("createNodePgPoolConfig", () => {
  it("allows self-signed certs for sslmode=require", () => {
    const config = createNodePgPoolConfig(
      "postgresql://user:pass@db.example.test:5432/life_ustc?sslmode=require",
    );

    expect(config.host).toBe("db.example.test");
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("keeps ssl disabled for sslmode=disable", () => {
    const config = createNodePgPoolConfig(
      "postgresql://user:pass@127.0.0.1:5432/life_ustc?sslmode=disable",
    );

    expect(config.ssl).toBe(false);
  });

  it("bounds the connect wait so a wedged database cannot hang an ingestion run", () => {
    const config = createNodePgPoolConfig(
      "postgresql://user:pass@db.example.test:5432/life_ustc?sslmode=require",
    );

    // pg treats 0/undefined as "wait forever".
    expect(config.connectionTimeoutMillis).toBe(NODE_PG_CONNECTION_TIMEOUT_MS);
    expect(config.connectionTimeoutMillis).toBeGreaterThan(0);
  });

  it("leaves query_timeout unset so long bulk loads are not truncated", () => {
    const config = createNodePgPoolConfig(
      "postgresql://user:pass@db.example.test:5432/life_ustc?sslmode=require",
    );

    expect(config.query_timeout).toBeUndefined();
  });
});
