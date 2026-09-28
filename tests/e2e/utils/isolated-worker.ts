import { type ChildProcess, fork } from "node:child_process";
import { createHmac } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type APIRequestContext, test as base } from "@playwright/test";
import { getCookies } from "better-auth/cookies";
import type { Unstable_DevOptions } from "wrangler";
import {
  createDatabaseTemplate,
  createIsolatedDatabase,
  type DatabaseTemplate,
  databaseConnectionsFromEnvironment,
  type IsolatedDatabase,
} from "../../shared/isolated-database-lifecycle";
import { getWorkerProcessEnvironment } from "./worker-database-env";

const authSecret = "e2e-dev-secret-not-for-production";
type Cookie = { name: string; value: string; url: string };
type Actor = { id: string; cookie: Cookie; request: APIRequestContext };
export type IsolatedWorker = {
  origin: string;
  database: IsolatedDatabase;
  createActor: (options?: { isAdmin?: boolean }) => Promise<Actor>;
};

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (!address || typeof address === "string")
    throw new Error("Missing TCP port");
  return address.port;
}
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
  if (child.exitCode === null && child.signalCode === null && child.connected)
    child.send({ type: "stop" });
  try {
    await withTimeout(
      exited,
      15_000,
      "Private Worker did not stop within 15 seconds",
    );
  } catch (error) {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (killError) {
        if ((killError as NodeJS.ErrnoException).code !== "ESRCH")
          throw killError;
      }
    }
    await exited;
    throw error;
  }
}

/** Global-state cases own the database and the actual workerd process/storage.
 * Ordinary user cases should keep using the cheaper shared Worker fixtures.
 */
export const test = base.extend<
  {
    isolatedWorker: IsolatedWorker;
  },
  { databaseTemplate: DatabaseTemplate }
>({
  databaseTemplate: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
    async ({}, use) => {
      const template = await createDatabaseTemplate(
        databaseConnectionsFromEnvironment(process.env),
      );
      try {
        await use(template);
      } finally {
        await template.dispose();
      }
    },
    { scope: "worker", timeout: 60_000 },
  ],
  isolatedWorker: [
    async ({ databaseTemplate, playwright }, use, testInfo) => {
      const database = await createIsolatedDatabase(databaseTemplate);
      let directory: string | undefined;
      let child: ChildProcess | undefined;
      let exited: Promise<void> | undefined;
      const requests: APIRequestContext[] = [];
      const log = createWriteStream(testInfo.outputPath("isolated-worker.log"));
      const failures: unknown[] = [];
      log.on("error", (error) => failures.push(error));
      try {
        directory = await mkdtemp(join(tmpdir(), "life-ustc-worker-"));
        const port = await availablePort();
        const origin = `http://localhost:${port}`;
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
            env: environment,
            detached: true,
            execArgv: [],
            silent: true,
          },
        );
        child.stdout?.pipe(log, { end: false });
        child.stderr?.pipe(log, { end: false });
        exited = new Promise<void>((resolve) => {
          child?.once("exit", () => resolve());
          child?.once("error", () => resolve());
        });
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
              if (message.type === "error") reject(new Error(message.message));
              if (message.type === "ready") {
                if (message.port !== port)
                  reject(new Error("Private Worker bound an unexpected port"));
                else resolve();
              }
            },
          );
        });
        void ready.catch(() => undefined);
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
        const options: Unstable_DevOptions = {
          config: resolve("wrangler.e2e.jsonc"),
          envFiles: [],
          local: true,
          port,
          inspectorPort: 0,
          vars: { APP_PUBLIC_ORIGIN: origin },
          persistTo: directory,
          logLevel: "error",
          experimental: { disableDevRegistry: true, watch: false },
        };
        child.send({
          type: "start",
          script: resolve("tests/ci/fixtures/e2e-storage-worker.ts"),
          options,
        });
        await withTimeout(
          ready,
          60_000,
          "Private Worker startup timed out; see isolated-worker.log",
        );
        const health = await fetch(`${origin}/api/health`);
        const healthBody = await health.text();
        if (health.status !== 200 || healthBody !== "ok\n")
          throw new Error(
            `Private Worker failed health check: ${health.status} ${healthBody.slice(0, 300)}`,
          );
        await use({
          origin,
          database,
          createActor: async ({ isAdmin = false } = {}) => {
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
            const sessionToken = crypto.randomUUID();
            await database.owner.session.create({
              data: {
                userId: id,
                sessionToken,
                expires: new Date(Date.now() + 60 * 60 * 1000),
              },
            });
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
            requests.push(request);
            return { id, cookie, request };
          },
        });
      } catch (error) {
        failures.push(error);
      }
      {
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
  baseURL: async ({ isolatedWorker }, use) => {
    await use(isolatedWorker.origin);
  },
});
