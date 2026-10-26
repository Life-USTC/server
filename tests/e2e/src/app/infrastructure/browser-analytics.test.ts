import {
  type BrowserContext,
  test as browserTest,
  expect,
  type Page,
  type Route,
} from "@playwright/test";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test as workerTest } from "../../../utils/owned-worker";
import { withPreferenceFlow } from "../../../utils/preference-flow";

const analytics = "https://www.googletagmanager.com/gtag/js?id=G-JNK35J2Q3R";

async function loadAnalytics(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(analytics),
    page.setContent(`<h1>Native load</h1><script src="${analytics}"></script>`),
  ]);
  expect(await page.evaluate(() => document.readyState)).toBe("complete");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain(
    "application/javascript",
  );
  return response.text();
}

browserTest(
  "browser workflows isolate analytics and release reused contexts",
  {
    tag: "@Infrastructure/Runtime",
  },
  async ({ page }) => {
    const context = page.context();
    const forwarded: string[] = [];
    const upstream = async (route: Route) => {
      forwarded.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "globalThis.analyticsForwarded = true;",
      });
    };
    await context.route(analytics, upstream);
    try {
      await withBrowserWorkflow(page, (workflow) =>
        workflow.run(() =>
          workflow.body(async () => {
            expect(await loadAnalytics(page)).toBe("");
            expect(forwarded).toEqual([]);
          }),
        ),
      );
      expect(page.isClosed()).toBe(true);
      expect(context.isClosed()).toBe(false);
      const reused = await context.newPage();
      try {
        expect(await loadAnalytics(reused)).toBe(
          "globalThis.analyticsForwarded = true;",
        );
        expect(
          await reused.evaluate(() =>
            Reflect.get(window, "analyticsForwarded"),
          ),
        ).toBe(true);
        expect(forwarded).toEqual([analytics]);
      } finally {
        await reused.close();
      }
    } finally {
      await context.unroute(analytics, upstream);
    }
  },
);

workerTest(
  "preference secondary contexts own analytics isolation and cleanup",
  {
    tag: "@Infrastructure/Runtime",
  },
  async ({ page, browser, request: observer, isolatedWorker, run }) => {
    const contexts: BrowserContext[] = [];
    const forwarded: string[] = [];
    const newContext = browser.newContext;
    // Install a deterministic native upstream before the flow acquires its
    // context. Missing isolation must forward here, never to the public network.
    browser.newContext = async (options) => {
      const context = await newContext.call(browser, options);
      contexts.push(context);
      await context.route(analytics, async (route) => {
        forwarded.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "globalThis.analyticsForwarded = true;",
        });
      });
      return context;
    };
    try {
      await run(() =>
        withPreferenceFlow(
          { page, browser, observer, isolatedWorker },
          (flow) =>
            flow.run(async () => {
              const context = await flow.newContext();
              const response = await flow.http(() =>
                context.request.get("/catalog/courses", {
                  headers: flow.headers,
                }),
              );
              expect(response.status()).toBe(200);
              const secondary = await flow.newPage(context);
              expect(await loadAnalytics(secondary)).toBe("");
              expect(forwarded).toEqual([]);
              await flow.closeContext(context);
              expect(context.isClosed()).toBe(true);
            }),
        ),
      );
      expect(contexts).toHaveLength(1);
      expect(contexts[0].isClosed()).toBe(true);
    } finally {
      browser.newContext = newContext;
      await Promise.all(contexts.map((context) => context.close()));
    }
  },
);
