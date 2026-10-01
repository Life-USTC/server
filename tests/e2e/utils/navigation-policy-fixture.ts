import {
  type APIResponse,
  expect,
  type Page,
  type Request,
} from "@playwright/test";
import { ownBrowserReads } from "./browser-read-lifecycle";
import { withBrowserWorkflow } from "./browser-workflow";
import { test as workerTest } from "./owned-worker";

type Run = (work: () => Promise<void>) => Promise<void>;

/** Temporary diagnostic: observe the genuine browser write without proxying it. */
async function withObservedNavigationWrites(
  page: Page,
  origin: string,
  run: () => Promise<void>,
  afterResponse: (
    response: Pick<APIResponse, "status" | "json">,
    request: Request,
  ) => Promise<void>,
) {
  const pending = new Set<Promise<void>>();
  const errors: unknown[] = [];
  let closing = false;
  const observe = (request: Request) => {
    if (
      new URL(request.url()).origin !== origin ||
      !["POST", "PUT", "PATCH", "DELETE"].includes(request.method())
    )
      return;
    const admitted = !closing;
    const operation = Promise.resolve()
      .then(async () => {
        if (!admitted)
          throw new Error("Navigation write started during fixture teardown");
        const response = await request.response();
        if (!response)
          throw new Error("Navigation write has no browser response");
        await afterResponse(response, request);
      })
      .catch((error: unknown) => {
        errors.push(error);
      });
    pending.add(operation);
    void operation.finally(() => pending.delete(operation));
  };
  const join = async () => {
    while (pending.size) await Promise.all(pending);
  };
  const close = async () => {
    try {
      await page.close();
    } catch (error) {
      errors.push(error);
    }
  };
  page.on("request", observe);
  let failed = false;
  try {
    await run();
  } catch (error) {
    failed = true;
    errors.push(error);
  } finally {
    closing = true;
    // A failed browser body wait may require page closure to reject. The outer
    // producer drain still owns server settlement while the private DB is live.
    if (failed) await close();
    await join();
    if (!failed) await close();
    await join();
    page.off("request", observe);
  }
  if (errors.length)
    throw new AggregateError(
      errors,
      "Navigation browser write observation failed",
    );
}

/** Navigation checks own their page, real writes and deferred Worker reads. */
export const test = workerTest.extend<{ navigationRun: Run }>({
  navigationRun: async (
    { page, request, isolatedWorker, run },
    use,
    testInfo,
  ) => {
    await run(() =>
      withBrowserWorkflow(page, async (workflow) => {
        await use((work) =>
          workflow.run(async () => {
            const origin = isolatedWorker.origin;
            const secret = {
              "x-test-storage-secret": "local-test-storage-observer",
            };
            const probeId = crypto.randomUUID();
            const probePath = `/__test/community-effects?id=${probeId}`;
            const headers = { ...secret, "x-test-community-probe": probeId };
            let accepting = true;
            let registered = false;
            let actualBody: Promise<void> | undefined;
            const errors: unknown[] = [];
            const reads = ownBrowserReads(page, origin, () => accepting);
            const attempt = async (work: () => unknown | Promise<unknown>) => {
              try {
                await work();
              } catch (error) {
                errors.push(error);
              }
            };
            try {
              const registration = await request.post(probePath, {
                headers: secret,
              });
              registered = registration.status() === 201;
              expect(registration.status()).toBe(201);
              await registration.body();
              await page.context().setExtraHTTPHeaders(headers);
              reads.start();
              await withObservedNavigationWrites(
                page,
                origin,
                async () => {
                  try {
                    await workflow.body(() => {
                      actualBody = Promise.resolve().then(work);
                      return actualBody;
                    });
                  } finally {
                    accepting = false;
                    await page.route(
                      (url) => url.origin === origin,
                      async (route) => {
                        if (route.request().redirectedFrom())
                          await route.fallback();
                        else await route.abort("aborted");
                      },
                    );
                    await expect
                      .poll(
                        () =>
                          [...reads.ownedReads.values()].filter(
                            (read) => !read.settled && !read.retiredBy,
                          ).length,
                        {
                          timeout: 15_000,
                          message:
                            "Navigation active reads reach their browser terminal",
                        },
                      )
                      .toBe(0);
                    reads.prepareRetiredClose();
                  }
                },
                async (response, incoming) => {
                  const path = new URL(incoming.url()).pathname;
                  expect(incoming.method()).toBe("POST");
                  expect(path).toMatch(
                    /^\/api\/workspace\/young-notifications\/[^/]+\/read$/,
                  );
                  const id = decodeURIComponent(path.split("/")[4]);
                  expect(response.status()).toBe(200);
                  expect(await response.json()).toEqual({ id, success: true });
                  expect(
                    await isolatedWorker.database.owner.youngNotification.findUnique(
                      { where: { id } },
                    ),
                  ).toMatchObject({ readAt: expect.any(Date) });
                },
              );
            } catch (error) {
              errors.push(error);
            } finally {
              accepting = false;
              // Closing the page releases interrupted browser waits. Join the actual
              // callback before observing effects, while its private DB is still live.
              await attempt(() => page.close());
              await attempt(() => actualBody);
              while (reads.pendingReads.size || reads.pendingNavigations.size)
                await Promise.allSettled([
                  ...reads.pendingReads,
                  ...reads.pendingNavigations,
                ]);
              reads.stop();
              errors.push(...reads.errors);
              if (registered) {
                await attempt(async () => {
                  // GET joins actual response streams and appended waitUntil work.
                  const response = await request.get(probePath, {
                    headers: secret,
                  });
                  expect(response.status()).toBe(200);
                  const producer = await response.json();
                  await testInfo.attach("navigation-effects", {
                    contentType: "application/json",
                    body: JSON.stringify({
                      database: isolatedWorker.database.name,
                      origin,
                      producer,
                      reads: reads.reads,
                      retiredReads: reads.retiredReads,
                      errors: errors.map(String),
                    }),
                  });
                  expect(producer.backgroundErrors).toEqual([]);
                  expect(producer.requests.length).toBeGreaterThan(0);
                  for (const completed of producer.requests) {
                    expect(completed.outcome).toBe("fulfilled");
                    expect(completed.result).toBeGreaterThanOrEqual(200);
                    expect(completed.result).toBeLessThan(400);
                  }
                  expect(producer.messages).toEqual([]);
                  expect(producer.purges).toEqual([]);
                });
                await attempt(async () => {
                  const response = await request.delete(probePath, {
                    headers: secret,
                  });
                  expect(response.status()).toBe(204);
                  await response.body();
                });
              }
            }
            if (errors.length)
              throw new AggregateError(
                errors,
                "Navigation workflow cleanup failed",
              );
          }),
        );
      }),
    );
  },
});
