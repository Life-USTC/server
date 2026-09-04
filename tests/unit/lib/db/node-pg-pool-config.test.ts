import { describe, expect, it } from "vitest";
import { createNodePgPoolConfig } from "@/lib/db/node-pg-pool-config";

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
});
