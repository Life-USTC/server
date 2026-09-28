import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { test } from "vitest";
import { createTestPrisma, type TestPrismaClient } from "./prisma";

const execute = promisify(execFile);
type Connections = Record<"owner" | "app" | "auth" | "maintenance", string>;
type DatabaseGrant = {
  grantee: string | null;
  privilege: "CREATE" | "CONNECT" | "TEMPORARY";
  grantable: boolean;
};
type DatabaseTemplate = {
  name: string;
  owner: string;
  grants: DatabaseGrant[];
  admin: TestPrismaClient;
  connections: Connections;
};
export type IsolatedDatabase = {
  name: string;
  connections: Connections;
  owner: TestPrismaClient;
  app: TestPrismaClient;
  auth: TestPrismaClient;
  maintenance: TestPrismaClient;
};

const identifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const databaseName = () =>
  `test_isolated_${crypto.randomUUID().replaceAll("-", "")}`;
function targetDatabase(connection: string, name: string) {
  const url = new URL(connection);
  url.pathname = `/${name}`;
  return url.href;
}
function requiredConnection(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`${name} is required for isolated database tests`);
  return value;
}

async function runPostgres(program: string, args: string[]) {
  try {
    return await execute(program, args, { maxBuffer: 1024 * 1024 });
  } catch (error) {
    // execFile's default message includes its arguments, including the URL.
    const details = error as { stderr?: string; code?: string };
    const stderr = details.stderr?.replace(
      /postgres(?:ql)?:\/\/[^\s]+/g,
      "[database]",
    );
    throw new Error(
      `${program} failed: ${stderr || details.code || "unknown error"}`,
    );
  }
}

async function copyDatabaseGrants(template: DatabaseTemplate, name: string) {
  // CREATE DATABASE copies schema ACLs, but not the database owner's ACL.
  await template.admin.$executeRawUnsafe(
    `REVOKE ALL ON DATABASE ${identifier(name)} FROM PUBLIC, ${identifier(template.owner)}`,
  );
  for (const grant of template.grants) {
    if (!["CREATE", "CONNECT", "TEMPORARY"].includes(grant.privilege))
      throw new Error("Unexpected source database privilege");
    await template.admin.$executeRawUnsafe(
      `GRANT ${grant.privilege} ON DATABASE ${identifier(name)} TO ${grant.grantee === null ? "PUBLIC" : identifier(grant.grantee)}${grant.grantable ? " WITH GRANT OPTION" : ""}`,
    );
  }
}

async function dropDatabase(admin: TestPrismaClient, name: string) {
  await admin.$executeRawUnsafe(
    `DROP DATABASE IF EXISTS ${identifier(name)} WITH (FORCE)`,
  );
}

/** Global maintenance/aggregate tests need separate databases, not row markers.
 * Snapshot schema/functions/ACLs from the bootstrapped source once per file.
 * Each test clones that immutable, empty template and gets explicit clients.
 */
export const isolatedDatabaseTest = test.extend<{
  $file: { databaseTemplate: DatabaseTemplate };
  $test: { isolatedDatabase: IsolatedDatabase };
}>({
  databaseTemplate: [
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
    async ({}, use) => {
      const connections = {
        owner: requiredConnection("FUNCTION_OWNER_DATABASE_URL"),
        app: requiredConnection("DATABASE_URL"),
        auth: requiredConnection("AUTH_DATABASE_URL"),
        maintenance: requiredConnection("MAINTENANCE_DATABASE_URL"),
      };
      const admin = createTestPrisma(
        targetDatabase(connections.owner, "postgres"),
      );
      const source = createTestPrisma(connections.owner);
      const name = databaseName();
      let directory: string | undefined;
      const cleanup = async () => {
        const cleanup = await Promise.allSettled([
          source.$disconnect(),
          dropDatabase(admin, name),
          ...(directory
            ? [rm(directory, { recursive: true, force: true })]
            : []),
        ]);
        await admin.$disconnect();
        const failures = cleanup.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (failures.length)
          throw new AggregateError(
            failures,
            "Database template cleanup failed",
          );
      };
      try {
        const [sourceDatabase] = await source.$queryRaw<
          Array<{ owner: string; version: number }>
        >`
        SELECT pg_catalog.pg_get_userbyid(datdba) AS owner,
          current_setting('server_version_num')::integer AS version
        FROM pg_catalog.pg_database WHERE datname = current_database()
      `;
        const grants = await source.$queryRaw<DatabaseGrant[]>`
        SELECT CASE WHEN acl.grantee = 0 THEN NULL ELSE pg_catalog.pg_get_userbyid(acl.grantee) END AS grantee,
          acl.privilege_type AS privilege, acl.is_grantable AS grantable
        FROM pg_catalog.pg_database AS database
        CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(database.datacl,
          pg_catalog.acldefault('d', database.datdba))) AS acl
        WHERE database.datname = current_database()
      `;
        await source.$disconnect();
        const { stdout } = await runPostgres("pg_dump", ["--version"]);
        const clientMajor = Number(stdout.match(/PostgreSQL\) (\d+)/)?.[1]);
        const serverMajor = Math.floor(sourceDatabase.version / 10_000);
        if (clientMajor !== serverMajor)
          throw new Error(
            `Isolated database tests require pg_dump ${serverMajor} on PATH; found ${stdout.trim()}`,
          );
        directory = await mkdtemp(join(tmpdir(), "life-ustc-test-schema-"));
        const schema = join(directory, "schema.sql");
        await runPostgres("pg_dump", [
          "--dbname",
          connections.owner,
          "--schema-only",
          "--file",
          schema,
        ]);
        await admin.$executeRawUnsafe(
          `CREATE DATABASE ${identifier(name)} TEMPLATE template0 OWNER ${identifier(sourceDatabase.owner)}`,
        );
        await runPostgres("psql", [
          "--dbname",
          targetDatabase(connections.owner, name),
          "-X",
          "--set=ON_ERROR_STOP=1",
          "--file",
          schema,
        ]);
        const template = {
          name,
          owner: sourceDatabase.owner,
          grants,
          admin,
          connections,
        };
        await copyDatabaseGrants(template, name);
        await use(template);
      } finally {
        await cleanup();
      }
    },
    { scope: "file" },
  ],
  isolatedDatabase: async ({ databaseTemplate: template }, use) => {
    const name = databaseName();
    const connections = Object.fromEntries(
      Object.entries(template.connections).map(([role, url]) => [
        role,
        targetDatabase(url, name),
      ]),
    ) as Connections;
    const clients = {
      owner: createTestPrisma(connections.owner),
      app: createTestPrisma(connections.app),
      auth: createTestPrisma(connections.auth),
      maintenance: createTestPrisma(connections.maintenance),
    };
    const cleanup = async () => {
      const cleanup = await Promise.allSettled(
        Object.values(clients).map((client) => client.$disconnect()),
      );
      await dropDatabase(template.admin, name);
      const failures = cleanup.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(
          failures,
          "Isolated database client cleanup failed",
        );
    };
    try {
      await template.admin.$executeRawUnsafe(
        `CREATE DATABASE ${identifier(name)} TEMPLATE ${identifier(template.name)} OWNER ${identifier(template.owner)}`,
      );
      await copyDatabaseGrants(template, name);
      await use({ name, connections, ...clients });
    } finally {
      await cleanup();
    }
  },
});
