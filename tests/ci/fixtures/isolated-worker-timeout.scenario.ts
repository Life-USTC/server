import childProcess from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import {
  type IsolatedWorker,
  test as workerTest,
} from "../../e2e/utils/isolated-worker";
import { createTestPrisma } from "../../shared/prisma";

const phase = process.env.ISOLATED_WORKER_PROBE_PHASE;
const probeOutput = process.env.ISOLATED_WORKER_PROBE_OUTPUT;
if (!probeOutput) throw new Error("ISOLATED_WORKER_PROBE_OUTPUT is required");
if (
  !["template", "clone", "ready", "health", "actor", "session"].includes(
    phase ?? "",
  )
)
  throw new Error("Unknown isolated Worker probe phase");

let privateWorker: IsolatedWorker | undefined;
const acquisition = {
  phase,
  users: 0,
  sessions: 0,
  contextsCreated: 0,
  contextsDisposed: 0,
  acquisitionError: "",
  lateActorError: "",
  lateSessionError: "",
};
const saveAcquisition = () =>
  writeFileSync(
    join(probeOutput, "acquisition-observed.json"),
    JSON.stringify(acquisition),
  );
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const acquisitionPhase = phase === "actor" || phase === "session";

if (phase === "template") {
  const originalExecFile = childProcess.execFile;
  childProcess.execFile = ((file: string, ...args: unknown[]) => {
    const argv = args[0];
    if (file !== "psql" || !Array.isArray(argv))
      return Reflect.apply(originalExecFile, childProcess, [file, ...args]);
    const connection = new URL(argv[argv.indexOf("--dbname") + 1]);
    const template = connection.pathname.slice(1);
    args[0] = [
      "--command",
      "SELECT pg_sleep(60) /* private-template-timeout */",
      ...argv,
    ];
    const child = Reflect.apply(originalExecFile, childProcess, [
      file,
      ...args,
    ]) as childProcess.ChildProcess;
    connection.pathname = "/postgres";
    const observer = createTestPrisma(connection.href);
    let polling = false;
    const timer = setInterval(() => {
      if (polling) return;
      polling = true;
      void (async () => {
        const activity = await observer.$queryRawUnsafe<
          Array<{ datname: string; wait_event: string; query: string }>
        >(
          "SELECT datname, wait_event, query FROM pg_stat_activity WHERE datname = $1 AND wait_event = 'PgSleep'",
          template,
        );
        if (!activity.length) return;
        clearInterval(timer);
        writeFileSync(
          join(probeOutput, "results", "fault-observed-template.json"),
          JSON.stringify({ phase, template, process: child.pid, activity }),
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
    return child;
  }) as typeof childProcess.execFile;
  syncBuiltinESMExports();
}

// Faults are confined to this disposable Playwright runner. The production
// fixture has no test modes and still starts its actual Worker and database.
type FaultFixtures = { fault: undefined; acquiringActor: undefined };
const test = workerTest.extend<FaultFixtures>({
  databaseTemplate: [
    async ({ _templateResources }, use) => {
      await _templateResources.initialize();
      const databaseTemplate = _templateResources;
      if (phase !== "clone") {
        try {
          await use(databaseTemplate);
        } finally {
          if (acquisitionPhase && privateWorker) {
            // This fixture outlives the per-test resource owner. Both APIs must
            // reject after closure without opening another session/context.
            for (const method of ["createActor", "createSession"] as const) {
              try {
                if (method === "createActor") await privateWorker.createActor();
                else await privateWorker.createSession("closed-session-probe");
              } catch (error) {
                acquisition[
                  method === "createActor"
                    ? "lateActorError"
                    : "lateSessionError"
                ] = errorMessage(error);
              }
            }
            saveAcquisition();
          }
        }
        return;
      }
      const url = new URL(databaseTemplate.connections.owner);
      url.pathname = `/${databaseTemplate.name}`;
      const blocker = createTestPrisma(url.href);
      try {
        await blocker.$queryRaw`SELECT 1`;
        // PostgreSQL must wait for this real template connection before cloning.
        await use(databaseTemplate);
      } finally {
        await blocker.$disconnect();
      }
    },
    { scope: "worker", timeout: phase === "template" ? 10_000 : 60_000 },
  ],
  fault: async ({ databaseTemplate, playwright }, use, testInfo) => {
    const marker = testInfo.outputPath("fault-observed.json");
    const originalFork = childProcess.fork;
    const originalFetch = globalThis.fetch;
    const originalNewContext = playwright.request.newContext;
    let server: ReturnType<typeof createServer> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let observation: Promise<void> | undefined;
    let observed = false;
    if (phase === "clone") {
      timer = setInterval(() => {
        if (observation || observed) return;
        observation = (async () => {
          let state: { database: string };
          try {
            state = JSON.parse(
              readFileSync(
                testInfo.outputPath("isolated-worker-state.json"),
                "utf8",
              ),
            );
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
            throw error;
          }
          const activity = await databaseTemplate.admin.$queryRawUnsafe<
            Array<{ query: string; state: string }>
          >(
            "SELECT query, state FROM pg_stat_activity WHERE application_name = $1 AND query LIKE 'CREATE DATABASE%' AND state = 'active'",
            state.database,
          );
          if (activity.length) {
            writeFileSync(marker, JSON.stringify({ phase, activity }));
            observed = true;
          }
        })();
        void observation.finally(() => {
          observation = undefined;
        });
      }, 20);
    } else if (phase === "ready") {
      childProcess.fork = (
        modulePath: string | URL,
        argsOrOptions?: readonly string[] | childProcess.ForkOptions,
        options?: childProcess.ForkOptions,
      ) => {
        const child = Array.isArray(argsOrOptions)
          ? originalFork(modulePath, argsOrOptions, options)
          : originalFork(
              modulePath,
              argsOrOptions as childProcess.ForkOptions | undefined,
            );
        const emit = child.emit;
        child.emit = function (event: string | symbol, ...args: unknown[]) {
          const message = args[0] as
            | { type?: string; port?: number }
            | undefined;
          if (event === "message" && message?.type === "ready") {
            writeFileSync(
              marker,
              JSON.stringify({ phase, port: message.port }),
            );
            // The real Worker is ready, but its caller never receives readiness.
            return true;
          }
          return emit.call(this, event, ...args);
        };
        return child;
      };
      syncBuiltinESMExports();
    } else if (phase === "health") {
      server = createServer((_request, _response) => {
        writeFileSync(
          marker,
          JSON.stringify({ phase, pendingHttpRequest: true }),
        );
        // Keep this actual HTTP response pending until the caller aborts it.
      });
      await new Promise<void>((resolve) =>
        server?.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing health probe port");
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (!url.endsWith("/api/health")) return originalFetch(input, init);
        const actual = await originalFetch(input, init);
        if (actual.status !== 200 || (await actual.text()) !== "ok\n")
          throw new Error(
            "The actual Worker was unhealthy before the injected network stall",
          );
        return originalFetch(`http://127.0.0.1:${address.port}`, init);
      };
    }
    if (acquisitionPhase) {
      playwright.request.newContext = async (options) => {
        const context = await originalNewContext.call(
          playwright.request,
          options,
        );
        acquisition.contextsCreated++;
        if (!privateWorker) throw new Error("Private Worker was not acquired");
        acquisition.users = await privateWorker.database.owner.user.count();
        acquisition.sessions =
          await privateWorker.database.owner.session.count();
        const dispose = context.dispose.bind(context);
        context.dispose = async (options) => {
          await dispose(options);
          acquisition.contextsDisposed++;
          saveAcquisition();
        };
        saveAcquisition();
        // The actual context exists, but reaches its owner after the native
        // acquiringActor fixture has timed out and begun resource teardown.
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        return context;
      };
    }
    try {
      await use(undefined);
    } finally {
      if (timer) clearInterval(timer);
      await observation;
      childProcess.fork = originalFork;
      syncBuiltinESMExports();
      globalThis.fetch = originalFetch;
      playwright.request.newContext = originalNewContext;
      // Do not abort the pending HTTP request here: resource-owner teardown
      // must cancel it, which then permits this server to close.
      server?.close();
    }
  },
  isolatedWorker: [
    async ({ _workerResources, fault: _fault }, use) => {
      const worker = await _workerResources.start();
      privateWorker = worker;
      await use(worker);
    },
    { scope: "test", timeout: phase === "clone" ? 2_000 : 20_000 },
  ],
  acquiringActor: [
    async ({ isolatedWorker }, use) => {
      if (acquisitionPhase) {
        try {
          if (phase === "actor") await isolatedWorker.createActor();
          else {
            const id = crypto.randomUUID();
            await isolatedWorker.database.owner.user.create({
              data: {
                id,
                email: `${id}@acquisition-probe.test`,
                name: "Session acquisition probe",
              },
            });
            await isolatedWorker.createSession(id);
          }
        } catch (error) {
          acquisition.acquisitionError = errorMessage(error);
          saveAcquisition();
          throw error;
        }
      }
      await use(undefined);
    },
    { timeout: 1_000 },
  ],
});

test("native setup timeout releases owned resources", async ({
  isolatedWorker,
  acquiringActor: _actor,
}) => {
  throw new Error(
    `The injected ${phase} stall was bypassed at ${isolatedWorker.origin}`,
  );
});
