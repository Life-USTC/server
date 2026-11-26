import { describe, expect, it } from "vitest";
import { postgresClientConfig } from "../../../../scripts/operations/postgres-client-config.mjs";

describe("postgresClientConfig", () => {
  it("uses libpq require semantics for encrypted self-signed connections", () => {
    const connectionString =
      "postgresql://user:password@db.example.test/life-ustc?sslmode=require";

    expect(postgresClientConfig(connectionString)).toEqual({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  });

  it.each(["verify-ca", "verify-full"])(
    "preserves certificate verification for sslmode=%s",
    (sslmode) => {
      const connectionString = `postgresql://db.example.test/life-ustc?sslmode=${sslmode}`;

      expect(postgresClientConfig(connectionString)).toEqual({
        connectionString,
      });
    },
  );
});
