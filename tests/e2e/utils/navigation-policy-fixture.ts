import { expect } from "@playwright/test";
import { ownBrowserReads } from "./browser-read-lifecycle";
import { withBrowserWorkflow } from "./browser-workflow";
import { test as workerTest } from "./owned-worker";
import { withSettledPageWrites } from "./settled-page-writes";

type Run = (work: () => Promise<void>) => Promise<void>;

/** Navigation checks own their page, real writes and deferred Worker reads. */
export const test = workerTest.extend<{ navigationRun: Run }>({
  navigationRun: async ({ page, request, isolatedWorker, run }, use) => {
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
              await withSettledPageWrites(
                page,
                (url) => url.origin === origin,
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
