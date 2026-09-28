import childProcess from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { dirname, join } from "node:path";
import { Client } from "pg";
import { isolatedDatabaseTest } from "../../shared/isolated-database";
import { createTestPrisma } from "../../shared/prisma";

const phase = process.env.ISOLATED_DATABASE_PROBE_PHASE;
const output = process.env.ISOLATED_DATABASE_PROBE_OUTPUT;
if (!output || !["template", "clone"].includes(phase ?? ""))
  throw new Error("Missing isolated database probe phase/output");
const probeOutput = output;
mkdirSync(probeOutput, { recursive: true });
const resources: {
  template?: string;
  database?: string;
  directory?: string;
  processes: number[];
} = { processes: [] };
function record() {
  writeFileSync(join(probeOutput, "resources.json"), JSON.stringify(resources));
}
function observe(name: string, expected: "PgSleep" | "CREATE DATABASE") {
  const connection = new URL(process.env.FUNCTION_OWNER_DATABASE_URL ?? "");
  connection.pathname = "/postgres";
  const observer = createTestPrisma(connection.href);
  let polling = false;
  const timer = setInterval(() => {
    if (polling) return;
    polling = true;
    void (async () => {
      const rows = await observer.$queryRawUnsafe<
        Array<{
          datname: string;
          application_name: string;
          state: string;
          query: string;
          wait_event: string | null;
        }>
      >(
        "SELECT datname, application_name, state, query, wait_event FROM pg_stat_activity WHERE (datname = $1 OR application_name = $1) AND state = 'active'",
        name,
      );
      const activity = rows.filter((row) =>
        expected === "PgSleep"
          ? row.wait_event === expected
          : row.query.startsWith(expected),
      );
      if (!activity.length) return;
      clearInterval(timer);
      writeFileSync(
        join(probeOutput, "fault-observed.json"),
        JSON.stringify({ phase, activity }),
      );
      await observer.$disconnect();
    })()
      .catch(async (error) => {
        clearInterval(timer);
        writeFileSync(join(probeOutput, "observer-error.txt"), String(error));
        await observer.$disconnect();
      })
      .finally(() => {
        polling = false;
      });
  }, 20);
  timer.unref();
}
const originalExecFile = childProcess.execFile;
childProcess.execFile = ((file: string, ...args: unknown[]) => {
  const argv = args[0];
  if (file === "psql" && Array.isArray(argv)) {
    const connection = new URL(argv[argv.indexOf("--dbname") + 1]);
    resources.template = connection.pathname.slice(1);
    resources.directory = dirname(argv[argv.indexOf("--file") + 1]);
    if (phase === "template")
      args[0] = [
        "--command",
        "SELECT pg_sleep(60) /* vitest-template-timeout */",
        ...argv,
      ];
  }
  const child = Reflect.apply(originalExecFile, childProcess, [
    file,
    ...args,
  ]) as childProcess.ChildProcess;
  if (["pg_dump", "psql"].includes(file) && child.pid) {
    resources.processes.push(child.pid);
    record();
  }
  if (file === "psql" && phase === "template" && resources.template)
    observe(resources.template, "PgSleep");
  return child;
}) as typeof childProcess.execFile;
syncBuiltinESMExports();
const originalQuery = Client.prototype.query;
Client.prototype.query = function (this: Client, ...args: unknown[]) {
  const query = args[0];
  if (
    typeof query === "string" &&
    query.startsWith("CREATE DATABASE") &&
    !query.includes("TEMPLATE template0")
  ) {
    resources.database = query.match(/^CREATE DATABASE "([^"]+)"/)?.[1];
    record();
    if (phase === "clone" && resources.database)
      observe(resources.database, "CREATE DATABASE");
  }
  return Reflect.apply(originalQuery, this, args);
} as typeof Client.prototype.query;

const test = isolatedDatabaseTest.extend<{ cloneBlocker: undefined }>({
  cloneBlocker: async ({ databaseTemplate }, use) => {
    if (phase !== "clone") return use(undefined);
    const connection = new URL(databaseTemplate.connections.owner);
    connection.pathname = `/${databaseTemplate.name}`;
    const blocker = createTestPrisma(connection.href);
    try {
      await blocker.$queryRaw`SELECT 1`;
      await use(undefined);
    } finally {
      await blocker.$disconnect();
    }
  },
});
if (phase === "clone") {
  test.beforeAll(async ({ databaseTemplate }) => {
    if (!databaseTemplate.name) throw new Error("Clone probe has no template");
  });
  test.beforeEach(async ({ cloneBlocker: _cloneBlocker }) => {});
}
test("native database setup timeout releases owned resources", async ({
  isolatedDatabase,
}) => {
  throw new Error(
    `Injected ${phase} stall was bypassed for ${isolatedDatabase.name}`,
  );
});
