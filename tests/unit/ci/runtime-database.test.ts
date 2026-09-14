import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>[]>(),
  disconnect: vi.fn(),
}));
vi.mock("../../shared/prisma", () => ({
  createTestPrisma: (url: string) => ({
    $queryRaw: async () => database.rows.get(url) ?? [],
  }),
  disconnectTestPrisma: database.disconnect,
}));

import { validateIntegrationDatabaseRoles } from "../../shared/runtime-database";

const environment = {
  DATABASE_URL: "postgresql://life_ustc_runtime:secret@localhost:5432/test",
  AUTH_DATABASE_URL:
    "postgresql://life_ustc_auth_runtime:secret@localhost:5432/test",
  MAINTENANCE_DATABASE_URL:
    "postgresql://life_ustc_maintenance_runtime:secret@localhost:5432/test",
  FUNCTION_OWNER_DATABASE_URL:
    "postgresql://postgres:secret@localhost:5432/test",
};

beforeEach(() => {
  database.rows.clear();
  database.disconnect.mockClear();
  for (const url of Object.values(environment)) {
    const role = new URL(url).username;
    database.rows.set(url, [
      {
        currentUser: role,
        sessionUser: role,
        superuser: role === "postgres",
        bypassRls: false,
        inherit: false,
        hasRoleMembership: false,
        ownsPublicRelation: false,
      },
    ]);
  }
});

describe("database-backed test environment guard", () => {
  it("accepts restricted runtimes and a separate owner for the same database", async () => {
    await expect(
      validateIntegrationDatabaseRoles(environment),
    ).resolves.toBeUndefined();
    expect(database.disconnect).toHaveBeenCalledTimes(4);
  });

  it.each([
    "superuser",
    "bypassRls",
    "inherit",
    "hasRoleMembership",
    "ownsPublicRelation",
  ])(
    "rejects a runtime with %s even when its username is correct",
    async (attribute) => {
      const [role] = database.rows.get(environment.AUTH_DATABASE_URL) ?? [];
      role[attribute] = true;
      await expect(
        validateIntegrationDatabaseRoles(environment),
      ).rejects.toThrow("AUTH_DATABASE_URL must connect as");
      expect(database.disconnect).toHaveBeenCalledTimes(3);
    },
  );

  it("rejects a runtime connection actually logged in as postgres", async () => {
    await expect(
      validateIntegrationDatabaseRoles({
        ...environment,
        DATABASE_URL: environment.FUNCTION_OWNER_DATABASE_URL,
      }),
    ).rejects.toThrow("DATABASE_URL must connect as");
  });

  it.each(["AUTH_DATABASE_URL", "FUNCTION_OWNER_DATABASE_URL"] as const)(
    "rejects %s pointing at a different database",
    async (name) => {
      await expect(
        validateIntegrationDatabaseRoles({
          ...environment,
          [name]: environment[name].replace("/test", "/wrong"),
        }),
      ).rejects.toThrow("must target the same database");
    },
  );

  it("rejects a runtime masquerading as the fixture owner", async () => {
    await expect(
      validateIntegrationDatabaseRoles({
        ...environment,
        FUNCTION_OWNER_DATABASE_URL: environment.DATABASE_URL,
      }),
    ).rejects.toThrow("must be an independent fixture connection");
  });

  it("requires the fixture owner instead of falling back to the runtime", async () => {
    await expect(
      validateIntegrationDatabaseRoles({
        ...environment,
        FUNCTION_OWNER_DATABASE_URL: undefined,
      }),
    ).rejects.toThrow("FUNCTION_OWNER_DATABASE_URL is required");
  });
});
