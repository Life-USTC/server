import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";
import { createTestPrisma, type TestPrismaClient } from "./prisma";

export type DatabaseConnections = Record<
  "owner" | "app" | "auth" | "maintenance",
  string
>;
type DatabaseGrant = {
  grantee: string | null;
  privilege: "CREATE" | "CONNECT" | "TEMPORARY";
  grantable: boolean;
};
export type DatabaseTemplate = {
  name: string;
  owner: string;
  grants: DatabaseGrant[];
  admin: TestPrismaClient;
  connections: DatabaseConnections;
  dispose: () => Promise<void>;
};
export type IsolatedDatabase = {
  name: string;
  connections: DatabaseConnections;
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
function requiredConnection(input: NodeJS.ProcessEnv, name: string) {
  const value = input[name]?.trim();
  if (!value)
    throw new Error(`${name} is required for isolated database tests`);
  return value;
}
export function databaseConnectionsFromEnvironment(
  input: NodeJS.ProcessEnv,
): DatabaseConnections {
  return {
    owner: requiredConnection(input, "FUNCTION_OWNER_DATABASE_URL"),
    app: requiredConnection(input, "DATABASE_URL"),
    auth: requiredConnection(input, "AUTH_DATABASE_URL"),
    maintenance: requiredConnection(input, "MAINTENANCE_DATABASE_URL"),
  };
}
async function dropDatabase(admin: TestPrismaClient, name: string) {
  await admin.$executeRawUnsafe(
    `DROP DATABASE IF EXISTS ${identifier(name)} WITH (FORCE)`,
  );
}

async function runPostgres(
  program: string,
  args: string[],
  signal: AbortSignal,
  processes: number[],
): Promise<{ stdout: string }> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    let result: { error: Error | null; stdout: string; stderr: string };
    const child = execFile(
      program,
      args,
      { maxBuffer: 1024 * 1024, signal },
      (error, stdout, stderr) => {
        result = { error, stdout, stderr };
      },
    );
    if (child.pid) processes.push(child.pid);
    // Abort errors can arrive before process exit. Ownership ends only at close.
    child.once("close", () => {
      if (signal.aborted) return reject(signal.reason);
      if (result.error) {
        const stderr = result.stderr.replace(
          /postgres(?:ql)?:\/\/[^\s]+/g,
          "[database]",
        );
        reject(new Error(`${program} failed: ${stderr || "unknown error"}`));
      } else resolve({ stdout: result.stdout });
    });
  });
}
async function copyDatabaseGrants(
  template: DatabaseTemplate,
  name: string,
  query: (sql: string) => Promise<unknown>,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  await query(
    `REVOKE ALL ON DATABASE ${identifier(name)} FROM PUBLIC, ${identifier(template.owner)}`,
  );
  for (const grant of template.grants) {
    signal.throwIfAborted();
    if (!["CREATE", "CONNECT", "TEMPORARY"].includes(grant.privilege))
      throw new Error("Unexpected source database privilege");
    await query(
      `GRANT ${grant.privilege} ON DATABASE ${identifier(name)} TO ${grant.grantee === null ? "PUBLIC" : identifier(grant.grantee)}${grant.grantable ? " WITH GRANT OPTION" : ""}`,
    );
  }
  signal.throwIfAborted();
}
/** One physical connection owns initialization, so cancellation cannot target
 * another pooled session or reconnect after teardown has begun. */
async function initializeOnConnection(
  connectionString: string,
  name: string,
  admin: TestPrismaClient,
  signal: AbortSignal,
  run: (client: Client) => Promise<void>,
) {
  const client = new Client({ connectionString, application_name: name });
  let backendPid: number | undefined;
  let cancellation: Promise<unknown> | undefined;
  const errors: unknown[] = [];
  client.on("error", (error) => {
    if (!signal.aborted) errors.push(error);
  });
  const cancel = () => {
    cancellation =
      backendPid === undefined
        ? client.end()
        : admin.$queryRawUnsafe(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = $1 AND application_name = $2",
            backendPid,
            name,
          );
    void cancellation.catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    await client.connect();
    signal.throwIfAborted();
    const {
      rows: [backend],
    } = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    backendPid = backend.pid;
    signal.throwIfAborted();
    await run(client);
    signal.throwIfAborted();
  } catch (error) {
    errors.push(signal.aborted ? signal.reason : error);
  }
  signal.removeEventListener("abort", cancel);
  const cleanup = await Promise.allSettled([
    client.end(),
    ...(cancellation ? [cancellation] : []),
  ]);
  errors.push(
    ...cleanup.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    ),
  );
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, "Database initializer failed");
}

export type OwnedDatabaseTemplate = DatabaseTemplate & {
  initialize: (signal?: AbortSignal) => Promise<void>;
  state: () => { template: string; directory?: string; processes: number[] };
};
/** Ownership is available before schema dump, CREATE or restore. */
export function ownDatabaseTemplate(
  connections: DatabaseConnections,
): OwnedDatabaseTemplate {
  const name = databaseName();
  const admin = createTestPrisma(targetDatabase(connections.owner, "postgres"));
  const abort = new AbortController();
  let directory: string | undefined;
  const processes: number[] = [];
  let initializing: Promise<void> | undefined;
  let disposing: Promise<void> | undefined;
  const template: OwnedDatabaseTemplate = {
    name,
    admin,
    connections,
    owner: "",
    grants: [],
    state: () => ({ template: name, directory, processes }),
    initialize: (signal) => {
      if (initializing)
        throw new Error("Database template was initialized twice");
      const active = signal
        ? AbortSignal.any([signal, abort.signal])
        : abort.signal;
      initializing = initializeOnConnection(
        connections.owner,
        name,
        admin,
        active,
        async (client) => {
          const {
            rows: [sourceDatabase],
          } = await client.query<{ owner: string; version: number }>(
            `SELECT pg_catalog.pg_get_userbyid(datdba) AS owner, current_setting('server_version_num')::integer AS version FROM pg_catalog.pg_database WHERE datname = current_database()`,
          );
          active.throwIfAborted();
          const { rows: grants } = await client.query<DatabaseGrant>(
            `SELECT CASE WHEN acl.grantee = 0 THEN NULL ELSE pg_catalog.pg_get_userbyid(acl.grantee) END AS grantee, acl.privilege_type AS privilege, acl.is_grantable AS grantable FROM pg_catalog.pg_database AS database CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(database.datacl, pg_catalog.acldefault('d', database.datdba))) AS acl WHERE database.datname = current_database()`,
          );
          template.owner = sourceDatabase.owner;
          template.grants = grants;
          const { stdout } = await runPostgres(
            "pg_dump",
            ["--version"],
            active,
            processes,
          );
          const clientMajor = Number(stdout.match(/PostgreSQL\) (\d+)/)?.[1]);
          const serverMajor = Math.floor(sourceDatabase.version / 10_000);
          if (clientMajor !== serverMajor)
            throw new Error(
              `Isolated database tests require pg_dump ${serverMajor} on PATH; found ${stdout.trim()}`,
            );
          active.throwIfAborted();
          directory = mkdtempSync(join(tmpdir(), "life-ustc-test-schema-"));
          const schema = join(directory, "schema.sql");
          await runPostgres(
            "pg_dump",
            ["--dbname", connections.owner, "--schema-only", "--file", schema],
            active,
            processes,
          );
          active.throwIfAborted();
          await client.query(
            `CREATE DATABASE ${identifier(name)} TEMPLATE template0 OWNER ${identifier(template.owner)}`,
          );
          active.throwIfAborted();
          await runPostgres(
            "psql",
            [
              "--dbname",
              targetDatabase(connections.owner, name),
              "-X",
              "--set=ON_ERROR_STOP=1",
              "--single-transaction",
              "--file",
              schema,
            ],
            active,
            processes,
          );
          await copyDatabaseGrants(
            template,
            name,
            (sql) => client.query(sql),
            active,
          );
        },
      );
      void initializing.catch(() => undefined);
      return initializing;
    },
    dispose: () => {
      disposing ??= (async () => {
        abort.abort(new Error("Database template resources disposed"));
        await initializing?.catch(() => undefined);
        const cleanup = await Promise.allSettled([
          dropDatabase(admin, name),
          ...(directory
            ? [rm(directory, { recursive: true, force: true })]
            : []),
        ]);
        await admin.$disconnect();
        const errors = cleanup.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (errors.length)
          throw new AggregateError(errors, "Database template cleanup failed");
      })();
      return disposing;
    },
  };
  return template;
}
export type OwnedDatabase = IsolatedDatabase & {
  initialize: (signal?: AbortSignal) => Promise<void>;
  dispose: () => Promise<void>;
};
/** Ownership exists before CREATE DATABASE starts, including a cancelled clone. */
export function ownIsolatedDatabase(template: DatabaseTemplate): OwnedDatabase {
  const name = databaseName();
  const connections = Object.fromEntries(
    Object.entries(template.connections).map(([role, url]) => [
      role,
      targetDatabase(url, name),
    ]),
  ) as DatabaseConnections;
  const clients = {
    owner: createTestPrisma(connections.owner),
    app: createTestPrisma(connections.app),
    auth: createTestPrisma(connections.auth),
    maintenance: createTestPrisma(connections.maintenance),
  };
  const abort = new AbortController();
  let initializing: Promise<void> | undefined;
  let disposing: Promise<void> | undefined;
  const initialize = (signal?: AbortSignal) => {
    if (initializing) throw new Error("Owned database was initialized twice");
    const active = signal
      ? AbortSignal.any([signal, abort.signal])
      : abort.signal;
    initializing = initializeOnConnection(
      targetDatabase(template.connections.owner, "postgres"),
      name,
      template.admin,
      active,
      async (client) => {
        await client.query(
          `CREATE DATABASE ${identifier(name)} TEMPLATE ${identifier(template.name)} OWNER ${identifier(template.owner)}`,
        );
        await copyDatabaseGrants(
          template,
          name,
          (sql) => client.query(sql),
          active,
        );
      },
    );
    void initializing.catch(() => undefined);
    return initializing;
  };
  const dispose = () => {
    disposing ??= (async () => {
      abort.abort(new Error("Owned database disposed"));
      await initializing?.catch(() => undefined);
      const cleanup = await Promise.allSettled(
        Object.values(clients).map((client) => client.$disconnect()),
      );
      await dropDatabase(template.admin, name);
      const failures = cleanup.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "Isolated database cleanup failed");
    })();
    return disposing;
  };
  return { name, connections, ...clients, initialize, dispose };
}
