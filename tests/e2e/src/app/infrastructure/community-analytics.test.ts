import { expect, type Page, type Route } from "@playwright/test";
import { withCommunityFlow } from "../../../utils/community-flow";
import { test } from "../../../utils/owned-worker";

const analytics = "https://www.googletagmanager.com/gtag/js?id=G-JNK35J2Q3R";

test("community analytics isolation preserves native loads and scenario routes", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, browser, request: observer, isolatedWorker, run }) => {
  const context = page.context();
  const forwarded: string[] = [];
  const upstreamMatch = (url: URL) =>
    url.origin === "https://www.googletagmanager.com";
  const upstream = async (route: Route) => {
    forwarded.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "globalThis.analyticsForwarded = true;",
    });
  };
  await context.route(upstreamMatch, upstream);
  try {
    await run(() =>
      withCommunityFlow(
        { page, browser, observer, isolatedWorker, account: null },
        (flow) =>
          flow.run(async () => {
            const load = async (current: Page) => {
              const [script, response] = await Promise.all([
                current.waitForResponse(analytics),
                current.goto("/catalog/courses"),
              ]);
              expect(response?.status()).toBe(200);
              await expect(
                current.getByRole("heading", {
                  level: 1,
                  name: /课程|Courses/i,
                }),
              ).toBeVisible();
              expect(await current.evaluate(() => document.readyState)).toBe(
                "complete",
              );
              expect(script.status()).toBe(200);
              expect(script.headers()["content-type"]).toContain(
                "application/javascript",
              );
              expect(await script.text()).toBe("");
            };
            await load(page);
            const secondary = await flow.newContext();
            const other = await secondary.newPage();
            await load(other);
            await flow.closeContext(secondary);
            expect(secondary.isClosed()).toBe(true);

            const nearMatch = `${analytics}-near`;
            await page.evaluate(
              (src) =>
                new Promise<void>((resolve, reject) => {
                  const script = document.createElement("script");
                  script.src = src;
                  script.onload = () => resolve();
                  script.onerror = () => reject(new Error("Script failed"));
                  document.head.append(script);
                }),
              nearMatch,
            );
            expect(
              await page.evaluate(() =>
                Reflect.get(window, "analyticsForwarded"),
              ),
            ).toBe(true);
            expect(forwarded).toEqual([nearMatch]);

            await flow.route(page, analytics, (route) =>
              route.fulfill({
                status: 200,
                contentType: "application/javascript",
                body: "globalThis.analyticsScenario = true;",
              }),
            );
            expect((await page.goto("/catalog/courses"))?.status()).toBe(200);
            expect(
              await page.evaluate(() =>
                Reflect.get(window, "analyticsScenario"),
              ),
            ).toBe(true);
            await flow.clearRoutes(page);
            await load(page);
            expect(forwarded).toEqual([nearMatch]);
          }),
      ),
    );
    expect(page.isClosed()).toBe(true);
    expect(context.isClosed()).toBe(false);
    const reused = await context.newPage();
    try {
      await reused.setContent(
        `<h1>Context reuse</h1><script src="${analytics}"></script>`,
      );
      expect(
        await reused.evaluate(() => Reflect.get(window, "analyticsForwarded")),
      ).toBe(true);
      expect(forwarded).toEqual([`${analytics}-near`, analytics]);
    } finally {
      await reused.close();
    }
  } finally {
    await context.unroute(upstreamMatch, upstream);
  }
});

test("community analytics preserves callback, fulfillment and cleanup failures", {
  tag: "@Infrastructure/Runtime",
}, async ({ page, browser, request: observer, isolatedWorker, run }) => {
  const context = page.context();
  const fulfillError = new Error("Controlled analytics fulfillment failure");
  const bodyError = new Error("Independent community body failure");
  const unrouteError = new Error("Controlled analytics cleanup failure");
  const unroute = context.unroute;
  context.unroute = async (match, handler) => {
    await unroute.call(context, match, handler);
    if (typeof match === "function" && match(new URL(analytics)))
      throw unrouteError;
  };
  try {
    const failure: unknown = await run(() =>
      withCommunityFlow(
        { page, browser, observer, isolatedWorker, account: null },
        (flow) =>
          flow.run(async () => {
            await flow.route(page, analytics, async (route) => {
              // Native page and context routes share this Request's Route.
              // Fail the context handler's fulfillment, then require its abort.
              route.fulfill = async () => {
                throw fulfillError;
              };
              await route.fallback();
            });
            const [failed, response] = await Promise.all([
              page.waitForEvent("requestfailed", {
                predicate: (incoming) => incoming.url() === analytics,
              }),
              page.goto("/catalog/courses"),
            ]);
            expect(failed.failure()?.errorText).toBe("net::ERR_ABORTED");
            expect(response?.status()).toBe(200);
            await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
            throw bodyError;
          }),
      ),
    ).catch((error: unknown) => error);
    const leaves = (error: unknown): unknown[] =>
      error instanceof AggregateError ? error.errors.flatMap(leaves) : [error];
    expect(new Set(leaves(failure))).toEqual(
      new Set([fulfillError, bodyError, unrouteError]),
    );
    expect(page.isClosed()).toBe(true);
    expect(context.isClosed()).toBe(false);
  } finally {
    context.unroute = unroute;
  }
});
