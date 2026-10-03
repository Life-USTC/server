import { type ChildProcess, fork } from "node:child_process";
import { createHmac } from "node:crypto";
import { createWriteStream, mkdirSync, mkdtempSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type APIRequestContext, test as base } from "@playwright/test";
import { getCookies } from "better-auth/cookies";
import type { unstable_startWorker } from "wrangler";
import {
  type DatabaseTemplate,
  databaseConnectionsFromEnvironment,
  type IsolatedDatabase,
  type OwnedDatabaseTemplate,
  ownDatabaseTemplate,
  ownIsolatedDatabase,
} from "../../shared/isolated-database-lifecycle";
import { getWorkerProcessEnvironment } from "./worker-database-env";

const authSecret = "e2e-dev-secret-not-for-production";
type Cookie = { name: string; value: string; url: string };
type Actor = { id: string; cookie: Cookie; request: APIRequestContext };
export type IsolatedWorker = {
  origin: string;
  database: IsolatedDatabase;
  createActor: (options?: { isAdmin?: boolean }) => Promise<Actor>;
  createSession: (userId: string) => Promise<Actor>;
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
async function stopWorker(child: ChildProcess, exited: Promise<void>) {
  function stopProcessGroup() {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  }
  let sendError: unknown;
  if (child.exitCode === null && child.signalCode === null && child.connected) {
    try {
      child.send({ type: "stop" });
    } catch (error) {
      sendError = error;
      child.kill("SIGTERM");
    }
  }
  try {
    await withTimeout(
      exited,
      15_000,
      "Private Worker did not stop within 15 seconds",
    );
  } catch (error) {
    stopProcessGroup();
    await exited;
    throw error;
  } finally {
    // A closed leader can leave workerd alive after an early crash. Always
    // terminate the owned group before deleting its database and persistence.
    stopProcessGroup();
  }
  if (sendError) throw sendError;
}

/** Stateful cases own the database and the actual workerd process/storage.
 * Stateless anonymous checks can use Playwright's base fixture.
 */
export const test = base.extend<
  {
    isolatedWorker: IsolatedWorker;
    workerBindings: Record<string, string>;
    _workerResources: { start: () => Promise<IsolatedWorker> };
  },
  {
    databaseTemplate: DatabaseTemplate;
    _templateResources: OwnedDatabaseTemplate;
  }
>({
  workerBindings: {},
  _templateResources: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
    async ({}, use, workerInfo) => {
      mkdirSync(workerInfo.project.outputDir, { recursive: true });
      const template = ownDatabaseTemplate(
        databaseConnectionsFromEnvironment(process.env),
      );
      const errors: unknown[] = [];
      try {
        await use(template);
      } catch (error) {
        errors.push(error);
      }
      const cleanup = await Promise.allSettled([
        writeFile(
          join(
            workerInfo.project.outputDir,
            `template-state-${template.name}.json`,
          ),
          JSON.stringify(template.state()),
        ),
        template.dispose(),
      ]);
      errors.push(
        ...cleanup.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        ),
      );
      if (errors.length === 1) throw errors[0];
      if (errors.length)
        throw new AggregateError(errors, "Database template fixture failed");
    },
    { scope: "worker", timeout: 60_000 },
  ],
  databaseTemplate: [
    async ({ _templateResources }, use) => {
      await _templateResources.initialize();
      await use(_templateResources);
    },
    { scope: "worker", timeout: 60_000 },
  ],
  _workerResources: [
    async ({ databaseTemplate, playwright, workerBindings }, use, testInfo) => {
      const database = ownIsolatedDatabase(databaseTemplate);
      const abort = new AbortController();
      let starting: Promise<IsolatedWorker> | undefined;
      let directory: string | undefined;
      let child: ChildProcess | undefined;
      let exited: Promise<void> | undefined;
      const requests: APIRequestContext[] = [];
      const acquisitions = new Set<Promise<Actor>>();
      function acquire(operation: () => Promise<Actor>): Promise<Actor> {
        // Register ownership before asynchronous allocation can begin. Callers
        // that resume after native teardown must not allocate new resources.
        const pending = Promise.resolve().then(() => {
          abort.signal.throwIfAborted();
          return operation();
        });
        acquisitions.add(pending);
        void pending.then(
          () => acquisitions.delete(pending),
          () => acquisitions.delete(pending),
        );
        return pending;
      }
      const log = createWriteStream(testInfo.outputPath("isolated-worker.log"));
      const failures: unknown[] = [];
      log.on("error", (error) => failures.push(error));
      const logClosed = new Promise<void>((resolve) =>
        log.once("close", resolve),
      );
      const start = () => {
        if (starting) throw new Error("Private Worker was started twice");
        starting = (async () => {
          await writeFile(
            testInfo.outputPath("isolated-worker-state.json"),
            JSON.stringify({
              database: database.name,
              template: databaseTemplate.name,
            }),
          );
          abort.signal.throwIfAborted();
          await database.initialize(abort.signal);
          abort.signal.throwIfAborted();
          directory = mkdtempSync(join(tmpdir(), "life-ustc-worker-"));
          let port: number | undefined;
          const environment = getWorkerProcessEnvironment({
            ...process.env,
            FUNCTION_OWNER_DATABASE_URL: database.connections.owner,
            DATABASE_URL: database.connections.app,
            AUTH_DATABASE_URL: database.connections.auth,
            MAINTENANCE_DATABASE_URL: database.connections.maintenance,
            CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
              database.connections.app,
            CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH:
              database.connections.auth,
            CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE:
              database.connections.maintenance,
            WRANGLER_SEND_METRICS: "false",
          });
          child = fork(
            resolve("tests/ci/fixtures/isolated-worker-process.mjs"),
            [],
            {
              // Wrangler's project-local bundles must also belong to this case,
              // including when a killed child cannot remove them itself.
              cwd: directory,
              env: environment,
              detached: true,
              execArgv: [],
              silent: true,
            },
          );
          for (const stream of [child.stdout, child.stderr]) {
            stream
              ?.on("error", (error) => failures.push(error))
              .pipe(log, {
                end: false,
              });
          }
          // close follows actual process exit AND stdio closure. IPC errors
          // are observations, never evidence that a live child has stopped.
          exited = new Promise<void>((resolve) =>
            child?.once("close", () => resolve()),
          );
          child.on("error", (error) => failures.push(error));
          const ready = new Promise<void>((resolve, reject) => {
            child?.once("error", reject);
            child?.once("exit", (code, signal) =>
              reject(
                new Error(
                  `Private Worker exited before ready (${code ?? signal})`,
                ),
              ),
            );
            child?.on(
              "message",
              (message: { type?: string; port?: number; message?: string }) => {
                if (message.type === "error")
                  reject(new Error(message.message));
                if (message.type === "ready") {
                  if (
                    !Number.isInteger(message.port) ||
                    !message.port ||
                    message.port < 1 ||
                    message.port > 65535
                  )
                    reject(
                      new Error("Private Worker reported an invalid port"),
                    );
                  else {
                    port = message.port;
                    resolve();
                  }
                }
              },
            );
          });
          void ready.catch(() => undefined);
          const cancelled = new Promise<never>((_, reject) => {
            abort.signal.addEventListener(
              "abort",
              () => reject(abort.signal.reason),
              { once: true },
            );
          });
          void cancelled.catch(() => undefined);
          await writeFile(
            testInfo.outputPath("isolated-worker-state.json"),
            JSON.stringify({
              database: database.name,
              template: databaseTemplate.name,
              directory,
              processGroup: child.pid,
            }),
          );
          abort.signal.throwIfAborted();
          const options: Parameters<typeof unstable_startWorker>[0] = {
            config: resolve("wrangler.e2e.jsonc"),
            entrypoint: resolve("tests/ci/fixtures/e2e-storage-worker.ts"),
            envFiles: [],
            bindings: Object.fromEntries(
              Object.entries(workerBindings).map(([name, value]) => [
                name,
                { type: "plain_text" as const, value },
              ]),
            ),
            dev: {
              remote: false,
              server: { hostname: "127.0.0.1", port: 0 },
              inspector: { port: 0 },
              persist: directory,
              logLevel: "error",
              watch: false,
              generateTypes: false,
            },
          };
          child.send({
            type: "start",
            options,
          });
          await withTimeout(
            Promise.race([ready, cancelled]),
            60_000,
            "Private Worker startup timed out; see isolated-worker.log",
          );
          abort.signal.throwIfAborted();
          const origin = `http://localhost:${port}`;
          await writeFile(
            testInfo.outputPath("isolated-worker-state.json"),
            JSON.stringify({
              database: database.name,
              template: databaseTemplate.name,
              directory,
              processGroup: child.pid,
              origin,
            }),
          );
          abort.signal.throwIfAborted();
          const health = await fetch(`${origin}/api/health`, {
            signal: abort.signal,
          });
          const healthBody = await health.text();
          abort.signal.throwIfAborted();
          if (health.status !== 200 || healthBody !== "ok\n")
            throw new Error(
              `Private Worker failed health check: ${health.status} ${healthBody.slice(0, 300)}`,
            );
          async function createSession(id: string): Promise<Actor> {
            abort.signal.throwIfAborted();
            await database.owner.user.findUniqueOrThrow({ where: { id } });
            abort.signal.throwIfAborted();
            const sessionToken = crypto.randomUUID();
            await database.owner.session.create({
              data: {
                userId: id,
                sessionToken,
                expires: new Date(Date.now() + 60 * 60 * 1000),
              },
            });
            abort.signal.throwIfAborted();
            const signature = createHmac("sha256", authSecret)
              .update(sessionToken)
              .digest("base64");
            const cookie = {
              name: getCookies({ baseURL: origin }).sessionToken.name,
              value: encodeURIComponent(`${sessionToken}.${signature}`),
              url: origin,
            };
            const request = await playwright.request.newContext({
              baseURL: origin,
              extraHTTPHeaders: {
                cookie: `${cookie.name}=${cookie.value}`,
                origin,
              },
            });
            // A context can arrive after cancellation. Own it before rejecting
            // so teardown can dispose it after all acquisitions have settled.
            requests.push(request);
            abort.signal.throwIfAborted();
            return { id, cookie, request };
          }
          return {
            origin,
            database,
            createSession: (id) => acquire(() => createSession(id)),
            createActor: ({ isAdmin = false } = {}) =>
              acquire(async () => {
                const id = crypto.randomUUID();
                await database.owner.user.create({
                  data: {
                    id,
                    email: `${id}@isolated-worker.test`,
                    emailVerified: true,
                    username: `iw${id.replaceAll("-", "").slice(0, 17)}`,
                    name: "Isolated Worker actor",
                    isAdmin,
                  },
                });
                abort.signal.throwIfAborted();
                return createSession(id);
              }),
          };
        })();
        void starting.catch(() => undefined);
        return starting;
      };
      try {
        // Register native teardown before the dependent fixture allocates or waits.
        await use({ start });
      } catch (error) {
        failures.push(error);
      }
      {
        abort.abort(new Error("Private Worker resources disposed"));
        await starting?.catch(() => undefined);
        // Do not snapshot request contexts or drop the database while a delayed
        // actor/session acquisition can still commit or return a new context.
        await Promise.allSettled([...acquisitions]);
        const results = await Promise.allSettled(
          requests.map((request) => request.dispose()),
        );
        // The child must have stopped before FORCE drop; otherwise deferred work
        // could reconnect to a database after fixture cleanup has begun.
        if (child && exited) {
          try {
            await stopWorker(child, exited);
          } catch (error) {
            results.push({ status: "rejected", reason: error });
          }
        }
        log.end();
        await logClosed;
        results.push(
          ...(await Promise.allSettled([
            database.dispose(),
            ...(directory
              ? [rm(directory, { recursive: true, force: true })]
              : []),
          ])),
        );
        const errors = failures.concat(
          results.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
        );
        if (errors.length === 1) throw errors[0];
        if (errors.length)
          throw new AggregateError(errors, "Private Worker lifecycle failed");
      }
    },
    { timeout: 90_000 },
  ],
  isolatedWorker: [
    async ({ _workerResources }, use) => {
      await use(await _workerResources.start());
    },
    { timeout: 90_000 },
  ],
  baseURL: async ({ isolatedWorker }, use) => {
    await use(isolatedWorker.origin);
  },
});
