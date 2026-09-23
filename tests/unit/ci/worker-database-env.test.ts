import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import {
  getWorkerProcessEnvironment,
  resolveWorkerDatabaseEnvironment,
} from "../../e2e/utils/worker-database-env";

const ownerUrl =
  "postgresql://fixture-owner:fixture-owner@127.0.0.1:55532/life_ustc_fixture";
const runtimeUrls = {
  DATABASE_URL:
    "postgresql://life-ustc-runtime:runtime@127.0.0.1:55532/life_ustc_runtime",
  AUTH_DATABASE_URL:
    "postgresql://life-ustc-auth-runtime:auth@127.0.0.1:55532/life_ustc_auth_runtime",
  MAINTENANCE_DATABASE_URL:
    "postgresql://life-ustc-maintenance-runtime:maintenance@127.0.0.1:55532/life_ustc_maintenance_runtime",
} as const;

const validEnvironment = {
  FUNCTION_OWNER_DATABASE_URL: ownerUrl,
  ...runtimeUrls,
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
    runtimeUrls.DATABASE_URL,
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH:
    runtimeUrls.AUTH_DATABASE_URL,
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE:
    runtimeUrls.MAINTENANCE_DATABASE_URL,
} satisfies NodeJS.ProcessEnv;

describe("real Worker database environment", () => {
  test("requires the owner, three runtime URLs, and their Hyperdrive mappings", () => {
    expect(resolveWorkerDatabaseEnvironment(validEnvironment)).toEqual(
      validEnvironment,
    );
  });

  test.each([
    "FUNCTION_OWNER_DATABASE_URL",
    "DATABASE_URL",
    "AUTH_DATABASE_URL",
    "MAINTENANCE_DATABASE_URL",
    "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE",
    "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH",
    "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE",
  ])("fails when %s is missing", (name) => {
    const input: NodeJS.ProcessEnv = { ...validEnvironment };
    delete input[name];

    expect(() => resolveWorkerDatabaseEnvironment(input)).toThrow(
      `${name} is required for real Worker tests`,
    );
  });

  test("rejects the fixture owner URL in any Worker connection", () => {
    expect(() =>
      resolveWorkerDatabaseEnvironment({
        ...validEnvironment,
        AUTH_DATABASE_URL: ownerUrl,
        CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH: ownerUrl,
      }),
    ).toThrow(
      "AUTH_DATABASE_URL, CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH must not use FUNCTION_OWNER_DATABASE_URL",
    );
  });

  test("rejects a Hyperdrive URL copied from another runtime binding", () => {
    expect(() =>
      resolveWorkerDatabaseEnvironment({
        ...validEnvironment,
        CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH:
          runtimeUrls.DATABASE_URL,
      }),
    ).toThrow(
      "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH must equal AUTH_DATABASE_URL",
    );
  });

  test("rejects duplicate restricted runtime URLs", () => {
    expect(() =>
      resolveWorkerDatabaseEnvironment({
        ...validEnvironment,
        AUTH_DATABASE_URL: runtimeUrls.DATABASE_URL,
        CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH:
          runtimeUrls.DATABASE_URL,
      }),
    ).toThrow(
      "DATABASE_URL, AUTH_DATABASE_URL, and MAINTENANCE_DATABASE_URL must be three distinct restricted runtime URLs",
    );
  });

  test("removes the elevated fixture URL from Wrangler's environment", () => {
    const environment = getWorkerProcessEnvironment({
      ...validEnvironment,
      EXTRA_TEST_VARIABLE: "preserved",
    });

    expect(environment).toMatchObject({
      ...runtimeUrls,
      EXTRA_TEST_VARIABLE: "preserved",
    });
    expect(environment).not.toHaveProperty("FUNCTION_OWNER_DATABASE_URL");
  });

  test("removes the owner URL from the actual spawned Worker environment", () => {
    const workerEnvironment = getWorkerProcessEnvironment(validEnvironment);
    const parentEnvironment = {
      ...process.env,
      FUNCTION_OWNER_DATABASE_URL: ownerUrl,
    };
    // Playwright merges its webServer env over the parent env. The launch
    // command then removes the inherited owner before starting Wrangler.
    const mergedEnvironment = { ...parentEnvironment, ...workerEnvironment };
    const child = spawnSync(
      "env",
      [
        "-u",
        "FUNCTION_OWNER_DATABASE_URL",
        process.execPath,
        "-e",
        'process.stdout.write(process.env.FUNCTION_OWNER_DATABASE_URL ?? "absent")',
      ],
      { encoding: "utf8", env: mergedEnvironment },
    );

    expect(child.error).toBeUndefined();
    expect(child.status).toBe(0);
    expect(child.stdout).toBe("absent");
  });
});
