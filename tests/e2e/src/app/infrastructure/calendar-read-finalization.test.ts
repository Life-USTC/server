import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Request, type Response } from "@playwright/test";
import { parse } from "jsonc-parser";
import { createDeferred } from "../../../../shared/deferred";
import type { ProducerObservation } from "../../../utils/calendar-effects";
import { withHomeworkEffects } from "../../../utils/homework-effects";
import { test } from "../../../utils/owned-worker";

for (const scenario of [
  "canceled before dispatch",
  "completed after navigation",
  "completed beside a native cancellation",
  "checkpoint remains strict",
] as const) {
  test(`calendar finalization: retired read ${scenario}`, {
    tag: "@Infrastructure/Runtime",
  }, async ({ page, isolatedWorker, run }) => {
    const account = await run(() => isolatedWorker.createActor());
    const dispatched = scenario.startsWith("completed");
    const assetErrors: unknown[] = [];
    const terminals: Promise<{
      request: Request;
      response?: Response | null;
      error?: unknown;
    }>[] = [];
    const workflow = run(() =>
      withHomeworkEffects(
        {
          page,
          isolatedWorker,
          account,
          calendarMessages: [],
          observeReads: true,
        },
        async ({
          readHeaders,
          headers,
          expectReadCancellation,
          checkpoint,
        }) => {
          const admitted = createDeferred<Request>();
          const scriptAdmitted = createDeferred<Request>();
          const release = createDeferred();
          const continued = createDeferred();
          let scriptPath: string | undefined;
          let scriptOperation: Promise<void> | undefined;
          const settled = new Set<Request>();
          let routeError: unknown;
          await page.route(
            "**/api/catalog/courses?search=retired-read",
            async (route) => {
              admitted.resolve(route.request());
              await release.promise;
              try {
                if (dispatched) {
                  const response = await route.fetch({
                    headers: readHeaders(route.request()),
                  });
                  expect(response.status()).toBe(200);
                  await route.fulfill({ response });
                } else {
                  await route.continue({
                    headers: readHeaders(route.request()),
                  });
                }
              } catch (error) {
                routeError = error;
              } finally {
                continued.resolve();
              }
            },
          );
          try {
            await page.goto("/api/catalog/semesters");
            if (scenario === "canceled before dispatch") {
              const config = parse(readFileSync("wrangler.e2e.jsonc", "utf8"));
              const entries = readdirSync(
                resolve(config.assets.directory, "_app/immutable/entry"),
              ).filter((name) => /^start\..+\.js$/.test(name));
              expect(entries).toHaveLength(1);
              scriptPath = `/_app/immutable/entry/${entries[0]}`;
              await page.route(
                new URL(scriptPath, isolatedWorker.origin).href,
                (route) => {
                  scriptAdmitted.resolve(route.request());
                  scriptOperation = release.promise
                    .then(() => route.continue())
                    .catch((error) => {
                      assetErrors.push(error);
                    });
                  return scriptOperation;
                },
              );
            }
            if (scenario === "completed beside a native cancellation") {
              await page.route(
                "**/api/catalog/courses?search=canceled-read",
                (route) => {
                  expectReadCancellation(page, route.request());
                  return route.abort("aborted");
                },
              );
              const canceled = page.waitForEvent("requestfailed", {
                predicate: (request) =>
                  request.url().endsWith("search=canceled-read"),
              });
              await page.evaluate(async () => {
                await fetch("/api/catalog/courses?search=canceled-read").catch(
                  () => undefined,
                );
              });
              expect((await canceled).failure()?.errorText).toBe(
                "net::ERR_ABORTED",
              );
            }
            await page.evaluate((scriptPath) => {
              if (scriptPath) {
                const script = document.createElement("script");
                script.type = "module";
                script.src = scriptPath;
                document.head.append(script);
              }
              void fetch("/api/catalog/courses?search=retired-read").catch(
                () => undefined,
              );
            }, scriptPath);
            const api = await admitted.promise;
            if (scriptPath) {
              const script = await scriptAdmitted.promise;
              expect(script.resourceType()).toBe("script");
              for (const request of [api, script]) {
                expect(request.failure()).toBeNull();
                terminals.push(
                  request.response().then(
                    (response) => {
                      settled.add(request);
                      return { request, response };
                    },
                    (error: unknown) => {
                      settled.add(request);
                      return { request, error };
                    },
                  ),
                );
              }
              await page.evaluate(() => document.readyState);
              expect(settled.size).toBe(0);
            }
            const replacement = await page.goto("/api/catalog/teachers");
            expect(replacement?.status()).toBe(200);
            expect(replacement?.request().isNavigationRequest()).toBe(true);
            release.resolve();
            await continued.promise;
            await scriptOperation;
            if (routeError) throw routeError;
            const response = await page.request.get(
              "/__test/community-effects?id=" +
                headers["x-test-community-probe"],
              { headers },
            );
            expect(response.status()).toBe(200);
            const producer: ProducerObservation = await response.json();
            const courses = producer.requests.filter(
              ({ value }) => value.path === "/api/catalog/courses",
            );
            expect(courses).toEqual(
              dispatched
                ? [
                    expect.objectContaining({
                      outcome: "fulfilled",
                      result: 200,
                    }),
                  ]
                : [],
            );
            if (scriptPath) {
              expect(
                producer.requests.filter(
                  ({ value }) => value.path === scriptPath,
                ),
              ).toEqual([]);
              expect(settled.size).toBe(0);
            }
            if (scenario === "checkpoint remains strict") {
              await checkpoint("Retired reads do not relax a checkpoint", {
                calendarMessages: [],
              });
            }
          } finally {
            release.resolve();
            await scriptOperation;
          }
        },
      ),
    );
    if (scenario === "checkpoint remains strict") {
      const failure: unknown = await workflow.catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AggregateError);
      expect((failure as AggregateError).errors.map(String)).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "Worker completed GET /api/catalog/courses (no browser response)",
          ),
        ]),
      );
    } else {
      const failure: unknown = await workflow.catch((error: unknown) => error);
      if (failure !== undefined || assetErrors.length)
        throw new AggregateError(
          [...(failure === undefined ? [] : [failure]), ...assetErrors],
          "Retired read workflow failed",
        );
    }
    expect(page.isClosed()).toBe(true);
    for (const terminal of await Promise.all(terminals)) {
      if (terminal.error !== undefined) {
        expect(terminal.error).toBeInstanceOf(Error);
        expect((terminal.error as Error).message).toBe(
          "request.response: Target page, context or browser has been closed",
        );
      } else if (terminal.response) {
        expect(terminal.response.status()).toBe(200);
      } else {
        expect(terminal.request.failure()?.errorText).toBe("net::ERR_ABORTED");
      }
    }
  });
}

test("calendar finalization rejects a missing active browser terminal", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, isolatedWorker, run }) => {
  const account = await run(() => isolatedWorker.createActor());
  const admitted = createDeferred();
  const failure: unknown = await run(() =>
    withHomeworkEffects(
      {
        page,
        isolatedWorker,
        account,
        calendarMessages: [],
        observeReads: true,
      },
      async ({ headers }) => {
        await page.goto("/api/catalog/semesters");
        await page.route("**/api/catalog/courses?search=active-read", () => {
          admitted.resolve();
        });
        await page.evaluate(() => {
          void fetch("/api/catalog/courses?search=active-read").catch(
            () => undefined,
          );
        });
        await admitted.promise;
        const response = await page.request.get(
          `/__test/community-effects?id=${headers["x-test-community-probe"]}`,
          { headers },
        );
        expect(response.status()).toBe(200);
        const producer: ProducerObservation = await response.json();
        expect(
          producer.requests.filter(
            ({ value }) => value.path === "/api/catalog/courses",
          ),
        ).toEqual([]);
      },
    ),
  ).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors.map(String)).toEqual(
    expect.arrayContaining([
      expect.stringContaining(
        "Current document reads receive a native browser terminal",
      ),
    ]),
  );
  expect(page.isClosed()).toBe(true);
});

test("calendar finalization rejects a settled browser response without its Worker record", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, isolatedWorker, run }) => {
  const account = await run(() => isolatedWorker.createActor());
  const failure: unknown = await run(() =>
    withHomeworkEffects(
      {
        page,
        isolatedWorker,
        account,
        calendarMessages: [],
        observeReads: true,
      },
      async ({ headers }) => {
        await page.goto("/api/catalog/semesters");
        // Fetch a real Worker response without this workflow's probe headers.
        // A browser 200 cannot substitute for the missing owned server record.
        await page.route(
          "**/api/catalog/courses?search=unowned-read",
          async (route) => {
            const response = await route.fetch();
            expect(response.status()).toBe(200);
            await route.fulfill({ response });
          },
        );
        expect(
          await page.evaluate(
            async () =>
              (await fetch("/api/catalog/courses?search=unowned-read")).status,
          ),
        ).toBe(200);
        await page.goto("/api/catalog/teachers");
        const response = await page.request.get(
          `/__test/community-effects?id=${headers["x-test-community-probe"]}`,
          { headers },
        );
        expect(response.status()).toBe(200);
        const producer: ProducerObservation = await response.json();
        expect(
          producer.requests.filter(
            ({ value }) => value.path === "/api/catalog/courses",
          ),
        ).toEqual([]);
      },
    ),
  ).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors.map(String)).toEqual(
    expect.arrayContaining([
      expect.stringContaining(
        "Worker completed GET /api/catalog/courses (200)",
      ),
    ]),
  );
  expect(page.isClosed()).toBe(true);
});

test("calendar finalization rejects a failed Worker completion for a retired read", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, isolatedWorker, run }) => {
  const account = await run(() => isolatedWorker.createActor());
  const failure: unknown = await run(() =>
    withHomeworkEffects(
      {
        page,
        isolatedWorker,
        account,
        calendarMessages: [],
        observeReads: true,
      },
      async ({ readHeaders, headers }) => {
        const admitted = createDeferred();
        const release = createDeferred();
        const completed = createDeferred();
        let routeError: unknown;
        await page.route(
          "**/api/catalog/courses?search=failed-read",
          async (route) => {
            admitted.resolve();
            await release.promise;
            try {
              const response = await route.fetch({
                headers: readHeaders(route.request()),
              });
              expect(response.status()).toBe(500);
              await response.body();
              // The replaced document no longer receives this response. Closing
              // retires its browser read, but must retain the real Worker failure.
            } catch (error) {
              routeError = error;
            } finally {
              completed.resolve();
            }
          },
        );
        try {
          await page.goto("/api/catalog/semesters");
          // This case owns the entire database. Make its real catalog query fail
          // without mocking a producer observation or altering shared grants.
          await isolatedWorker.database.owner.$executeRawUnsafe(
            'ALTER TABLE "Course" RENAME TO "UnavailableCourse"',
          );
          await page.evaluate(() => {
            void fetch("/api/catalog/courses?search=failed-read").catch(
              () => undefined,
            );
          });
          await admitted.promise;
          await page.goto("/api/catalog/semesters?page=2");
          release.resolve();
          await completed.promise;
          if (routeError) throw routeError;
          const response = await page.request.get(
            `/__test/community-effects?id=${headers["x-test-community-probe"]}`,
            { headers },
          );
          expect(response.status()).toBe(200);
          const producer: ProducerObservation = await response.json();
          expect(
            producer.requests.filter(
              ({ value }) => value.path === "/api/catalog/courses",
            ),
          ).toEqual([
            expect.objectContaining({ outcome: "fulfilled", result: 500 }),
          ]);
        } finally {
          release.resolve();
        }
      },
    ),
  ).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors.map(String)).toEqual(
    expect.arrayContaining([
      expect.stringContaining("Canceled Worker read GET /api/catalog/courses"),
    ]),
  );
  expect(page.isClosed()).toBe(true);
});

test("calendar finalization audits unmatched Worker requests after page closure", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, isolatedWorker, run }) => {
  const account = await run(() => isolatedWorker.createActor());
  const ready = createDeferred();
  const closed = page.waitForEvent("close");
  let completedAfterClose = false;
  const failure: unknown = await run(() =>
    withHomeworkEffects(
      {
        page,
        isolatedWorker,
        account,
        calendarMessages: [],
        observeReads: true,
        async runBody(body) {
          // The workflow wrapper may finish waiting before its callback. The
          // helper must join that callback before its final independent audit.
          void body();
          await ready.promise;
        },
      },
      async ({ headers, expectReadCancellation }) => {
        await page.goto("/api/catalog/semesters");
        await page.route(
          "**/api/catalog/courses?search=canceled-read",
          (route) => {
            expectReadCancellation(page, route.request());
            return route.abort("aborted");
          },
        );
        const canceled = page.waitForEvent("requestfailed", {
          predicate: (request) =>
            request.url().endsWith("search=canceled-read"),
        });
        await page.evaluate(async () => {
          await fetch("/api/catalog/courses?search=canceled-read").catch(
            () => undefined,
          );
        });
        expect((await canceled).failure()?.errorText).toBe("net::ERR_ABORTED");
        ready.resolve();
        await closed;
        const response = await account.request.get(
          "/api/catalog/courses?search=unmatched-read",
          {
            headers: {
              ...headers,
              "x-test-community-request": crypto.randomUUID(),
            },
          },
        );
        expect(response.status()).toBe(200);
        await response.body();
        completedAfterClose = true;
      },
    ),
  ).catch((error: unknown) => error);
  expect(completedAfterClose).toBe(true);
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors.map(String)).toEqual(
    expect.arrayContaining([
      expect.stringContaining(
        "Every tagged Worker request belongs to an observed browser request",
      ),
    ]),
  );
  expect(page.isClosed()).toBe(true);
});
