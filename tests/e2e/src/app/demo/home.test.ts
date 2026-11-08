import {
  type APIResponse,
  expect,
  type Locator,
  type Request,
  type Route,
} from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

async function fulfillUnlessAborted(route: Route, response: APIResponse) {
  await route.fulfill({ response }).catch((error: unknown) => {
    if (route.request().failure()?.errorText !== "net::ERR_ABORTED")
      throw error;
  });
}

type HomeModeObservation = {
  personal: Element | null;
  campus: Element | null;
  leak: boolean;
  observer: MutationObserver;
};

test("demo.home: same-page mode change discards held ordinary Home responses", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          const actor = await isolatedWorker.createActor();
          const privateTitle = "Private ordinary Home task before demo";
          await isolatedWorker.database.owner.todo.create({
            data: {
              userId: actor.id,
              title: privateTitle,
              dueAt: new Date("2026-09-23T18:00:00+08:00"),
            },
          });
          await page.setViewportSize({ width: 1280, height: 844 });
          await page.context().addCookies([
            actor.cookie,
            {
              name: "NEXT_LOCALE",
              value: "en-us",
              url: isolatedWorker.origin,
            },
          ]);
          const release = createDeferred();
          const captured = createDeferred();
          void captured.promise.catch(() => undefined);
          const heldKinds = new Set<string>();
          const heldRequests: Request[] = [];
          const terminals = new Map<Request, "finished" | "failed">();
          const operations: Promise<void>[] = [];
          const errors: unknown[] = [];
          let holdOrdinary = true;
          const finished = (request: Request) => {
            if (heldRequests.includes(request))
              terminals.set(request, "finished");
          };
          const failed = (request: Request) => {
            if (heldRequests.includes(request))
              terminals.set(request, "failed");
          };
          const closing = () => {
            release.resolve();
            captured.reject(
              new Error("Home closed before ordinary responses were captured"),
            );
          };
          const pattern = /\/_internal\/home\/(?:viewer|campus-now)(?:\?|$)/;
          const handler = (route: Route) => {
            const operation = (async () => {
              if (!holdOrdinary) return route.continue();
              const response = await route.fetch();
              expect(response.status()).toBe(200);
              const url = new URL(route.request().url());
              const body = await response.json();
              const kind = url.pathname.endsWith("/viewer")
                ? "viewer"
                : url.searchParams.get("section");
              if (kind === "viewer") {
                expect(body.navStats.user.id).toBe(actor.id);
                expect(body.todos).toEqual(
                  expect.arrayContaining([
                    expect.objectContaining({ title: privateTitle }),
                  ]),
                );
              } else {
                expect(["weather", "bus"]).toContain(kind);
                expect(JSON.stringify(body)).not.toContain("Fictional");
              }
              if (!kind) throw new Error("Missing actual Home section");
              heldKinds.add(kind);
              heldRequests.push(route.request());
              if (heldKinds.size === 3) captured.resolve();
              await release.promise;
              await fulfillUnlessAborted(route, response);
            })();
            operations.push(
              operation.catch((error: unknown) => {
                errors.push(error);
                captured.reject(error);
              }),
            );
            return operation;
          };
          try {
            page.on("close", closing);
            page.on("requestfinished", finished);
            page.on("requestfailed", failed);
            await page.route(pattern, handler);
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await page.waitForFunction(
              () =>
                document.documentElement.dataset.lifeUstcHydrated === "true",
            );
            await captured.promise;
            await expect(
              page.getByTestId("home-personal-overview"),
            ).toHaveAttribute("aria-busy", "true");
            await expect(page.getByTestId("home-campus-now")).toHaveAttribute(
              "aria-busy",
              "true",
            );
            await page.evaluate((oldTitle) => {
              const state = window as typeof window & {
                demoHomeMode?: HomeModeObservation;
              };
              const observer = new MutationObserver(() => {
                if (
                  !document.querySelector('[data-testid="demo-home-samples"]')
                )
                  return;
                const personal = document.querySelector(
                  '[data-testid="home-personal-overview"]',
                );
                const weather = document.querySelector(
                  '[data-testid="home-weather"]',
                );
                const bus = document.querySelector('[data-testid="home-bus"]');
                if (
                  personal?.textContent?.includes(oldTitle) ||
                  personal?.querySelector('[data-slot="alert"]') ||
                  (weather?.getAttribute("aria-busy") === "false" &&
                    !weather.textContent?.includes("Fictional")) ||
                  (bus?.getAttribute("aria-busy") === "false" &&
                    !bus.textContent?.includes("Fictional departures"))
                ) {
                  if (state.demoHomeMode) state.demoHomeMode.leak = true;
                }
              });
              state.demoHomeMode = {
                personal: document.querySelector(
                  '[data-testid="home-personal-overview"]',
                ),
                campus: document.querySelector(
                  '[data-testid="home-campus-now"]',
                ),
                leak: false,
                observer,
              };
              observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ["aria-busy"],
              });
            }, privateTitle);
            holdOrdinary = false;
            await page.context().clearCookies();
            await page.context().addCookies([
              {
                ...(await createSignedDemoCookie({
                  issuedAt: Math.floor(Date.now() / 1000),
                })),
                url: isolatedWorker.origin,
              },
              {
                name: "NEXT_LOCALE",
                value: "en-us",
                url: isolatedWorker.origin,
              },
            ]);
            await page
              .getByTestId("app-sidebar")
              .getByRole("link", { name: "Life@USTC: Home", exact: true })
              .filter({ visible: true })
              .click();
            await expect(page).toHaveURL(`${isolatedWorker.origin}/`);
            await expect(page.getByTestId("demo-home-samples")).toBeVisible();
            await expect(
              page.getByTestId("home-personal-overview"),
            ).toContainText("Linear Algebra");
            await expect(page.getByTestId("home-weather")).toContainText(
              "Fictional",
            );
            await expect(
              page.getByTestId("home-bus").locator("li"),
            ).toHaveCount(5);
            await expect(page.getByTestId("home-bus")).toContainText(
              "Fictional departures",
            );
            release.resolve();
            await page.unroute(pattern, handler);
            await Promise.all(operations);
            expect([...heldKinds].sort()).toEqual(["bus", "viewer", "weather"]);
            await expect
              .poll(() =>
                heldRequests.every((request) => terminals.has(request)),
              )
              .toBe(true);
            for (const request of heldRequests)
              if (terminals.get(request) === "failed")
                expect(request.failure()?.errorText).toBe("net::ERR_ABORTED");
            // As in the ordinary owner control: native completion, then one rendering opportunity.
            await page.evaluate(
              () =>
                new Promise<void>((resolve) =>
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                  ),
                ),
            );
            await expect(
              page.getByTestId("home-personal-overview"),
            ).not.toContainText(privateTitle);
            await expect(
              page.getByTestId("home-personal-overview"),
            ).toContainText("Linear Algebra");
            await expect(
              page
                .getByTestId("home-personal-overview")
                .locator('[data-slot="alert"]'),
            ).toHaveCount(0);
            await expect(page.getByTestId("home-weather")).toContainText(
              "Fictional",
            );
            await expect(
              page.getByTestId("home-bus").locator("li"),
            ).toHaveCount(5);
            expect(
              await page.evaluate(() => {
                const state = (
                  window as typeof window & {
                    demoHomeMode?: HomeModeObservation;
                  }
                ).demoHomeMode;
                return {
                  sameDocument: Boolean(state),
                  samePersonalNode:
                    state?.personal ===
                    document.querySelector(
                      '[data-testid="home-personal-overview"]',
                    ),
                  sameCampusNode:
                    state?.campus ===
                    document.querySelector('[data-testid="home-campus-now"]'),
                  leak: state?.leak,
                };
              }),
            ).toEqual({
              sameDocument: true,
              samePersonalNode: true,
              sameCampusNode: true,
              leak: false,
            });
          } catch (error) {
            errors.push(error);
          } finally {
            release.resolve();
            captured.reject(
              new Error("Home mode workflow finished before ordinary capture"),
            );
            if (!page.isClosed()) {
              await page
                .unroute(pattern, handler)
                .catch((error: unknown) => errors.push(error));
              await page
                .evaluate(() =>
                  (
                    window as typeof window & {
                      demoHomeMode?: HomeModeObservation;
                    }
                  ).demoHomeMode?.observer.disconnect(),
                )
                .catch((error: unknown) => errors.push(error));
            }
            await Promise.all(operations);
            page.off("close", closing);
            page.off("requestfinished", finished);
            page.off("requestfailed", failed);
          }
          if (errors.length === 1) throw errors[0];
          if (errors.length)
            throw new AggregateError(
              errors,
              "Home same-page mode workflow failed",
            );
        }),
      ),
    ),
  );
});

test("demo.home: held bootstrap preserves read-only Home without a sign-in invitation", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await page.context().addCookies([
            {
              ...(await createSignedDemoCookie({
                issuedAt: Math.floor(Date.now() / 1000),
              })),
              url: isolatedWorker.origin,
            },
            { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
          ]);
          const release = createDeferred();
          const captured = createDeferred();
          void captured.promise.catch(() => undefined);
          const secret = {
            "x-test-storage-secret": "local-test-storage-observer",
          };
          const probeId = crypto.randomUUID();
          const probe = `/__test/community-effects?id=${probeId}`;
          let probeRegistered = false;
          const viewerData = createDeferred<{
            navStats: { user: { id: string } };
            demo: { fixtureVersion: string; expiresAt: number };
          }>();
          void viewerData.promise.catch(() => undefined);
          let expectedExpiry = 0;
          const operations: Promise<void>[] = [];
          const errors: unknown[] = [];
          const handler = (route: Route) => {
            const operation = (async () => {
              const response = await route.fetch();
              expect(response.status()).toBe(200);
              if (
                new URL(route.request().url()).pathname ===
                "/_internal/home/viewer"
              ) {
                viewerData.resolve(await response.json());
                await fulfillUnlessAborted(route, response);
                return;
              }
              const bootstrap = await response.json();
              expect(bootstrap.viewer).toBeNull();
              expect(bootstrap.demo.fixtureVersion).toBe("workspace-v1");
              expectedExpiry = bootstrap.demo.expiresAt;
              captured.resolve();
              await release.promise;
              await fulfillUnlessAborted(route, response);
            })();
            operations.push(
              operation.catch((error: unknown) => {
                errors.push(error);
                captured.reject(error);
                viewerData.reject(error);
              }),
            );
            return operation;
          };
          const pattern =
            /\/_internal\/(?:shell-bootstrap|home\/viewer)(?:\?|$)/;
          const close = () => {
            release.resolve();
            captured.reject(new Error("Home closed before bootstrap capture"));
            viewerData.reject(new Error("Home closed before viewer capture"));
          };
          try {
            const registration = await page.request.post(`${probe}&io=1`, {
              headers: secret,
            });
            probeRegistered = registration.status() === 201;
            await registration.body();
            expect(registration.status()).toBe(201);
            await page.setExtraHTTPHeaders({
              ...secret,
              "x-test-community-probe": probeId,
            });
            page.on("close", close);
            await page.route(pattern, handler);
            const html = await page.goto("/", { waitUntil: "load" });
            if (!html) throw new Error("Missing Home HTML response");
            expect(html?.status()).toBe(200);
            const htmlBody = await html.text();
            expect(htmlBody).not.toContain('data-testid="home-sign-in"');
            expect(htmlBody).toContain("Sample reading room hours");
            expect(htmlBody).toContain("Demo account · Read only");
            await captured.promise;
            await expect(page.getByTestId("demo-notice")).toBeVisible();
            await expect(
              page.getByTestId("home-personal-overview"),
            ).toBeVisible();
            await expect(page.getByTestId("home-sign-in")).toHaveCount(0);
            release.resolve();
            await Promise.all(operations);
            expect(errors).toEqual([]);
            await expect(
              page.getByTestId("home-personal-overview"),
            ).toHaveAttribute("aria-busy", "false");
            await expect(page.getByTestId("home-campus-now")).toHaveAttribute(
              "aria-busy",
              "false",
            );
            expect(await viewerData.promise).toMatchObject({
              navStats: { user: { id: "demo:workspace-v1" } },
              demo: {
                fixtureVersion: "workspace-v1",
                expiresAt: expectedExpiry,
              },
            });
            const effects = await page.request.get(probe, { headers: secret });
            expect(effects.status()).toBe(200);
            const observed = await effects.json();
            expect(observed).toMatchObject({
              purges: [],
              messages: [],
              backgroundErrors: [],
              io: { bindings: [], outbound: [] },
            });
            expect(observed.requests).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  outcome: "fulfilled",
                  value: expect.objectContaining({
                    method: "GET",
                    path: "/_internal/home/viewer",
                  }),
                }),
              ]),
            );
          } catch (error) {
            errors.push(error);
          } finally {
            release.resolve();
            captured.reject(
              new Error("Home workflow finished before bootstrap capture"),
            );
            viewerData.reject(
              new Error("Home workflow finished before viewer capture"),
            );
            if (!page.isClosed())
              await page
                .unroute(pattern, handler)
                .catch((error: unknown) => errors.push(error));
            await Promise.all(operations);
            page.off("close", close);
            try {
              const removed = await page.request.delete(probe, {
                headers: secret,
              });
              await removed.body();
              if (probeRegistered) expect(removed.status()).toBe(204);
              else expect([204, 404]).toContain(removed.status());
            } catch (error) {
              errors.push(error);
            }
          }
          if (errors.length === 1) throw errors[0];
          if (errors.length)
            throw new AggregateError(
              errors,
              "Held Home bootstrap workflow failed",
            );
        }),
      ),
    ),
  );
});

async function expectReadable(locator: Locator) {
  await locator.evaluate(() => document.fonts.ready);
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const facts = await locator.evaluate((root) => {
    const failures: unknown[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let rectangles = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const auxiliary = node.parentElement?.closest(".sr-only");
      if (auxiliary) {
        const style = getComputedStyle(auxiliary);
        const zeroClip =
          style.clip === "rect(0px, 0px, 0px, 0px)" ||
          style.clipPath === "inset(50%)";
        if (
          style.position === "absolute" &&
          style.width === "1px" &&
          style.height === "1px" &&
          /^(hidden|clip)$/.test(style.overflowX) &&
          /^(hidden|clip)$/.test(style.overflowY) &&
          zeroClip
        )
          continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        rectangles++;
        if (
          rect.left < 0 ||
          rect.top < 0 ||
          rect.right > document.documentElement.clientWidth ||
          rect.bottom > innerHeight
        )
          failures.push({
            text: node.textContent,
            clip: "viewport",
            rect: rect.toJSON(),
          });
        for (
          let element = node.parentElement;
          element;
          element = element.parentElement
        ) {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          if (
            (/^(hidden|clip|auto|scroll)$/.test(style.overflowX) &&
              (rect.left <
                box.left + Number.parseFloat(style.borderLeftWidth) ||
                rect.right >
                  box.right - Number.parseFloat(style.borderRightWidth))) ||
            (/^(hidden|clip|auto|scroll)$/.test(style.overflowY) &&
              (rect.top < box.top + Number.parseFloat(style.borderTopWidth) ||
                rect.bottom >
                  box.bottom - Number.parseFloat(style.borderBottomWidth)))
          )
            failures.push({
              text: node.textContent,
              clip: element.tagName,
              rect: rect.toJSON(),
              box: box.toJSON(),
            });
        }
      }
    }
    return { rectangles, failures };
  });
  expect(facts.rectangles).toBeGreaterThan(0);
  expect(facts.failures).toEqual([]);
}

for (const locale of ["en-us", "zh-cn"] as const)
  for (const width of [1280, 390]) {
    test(
      `demo.home: existing read-only Home ${locale} ${width}`,
      { tag: "@Account/Web" },
      async ({ page, isolatedWorker, run }, testInfo) => {
        await withBrowserWorkflow(page, (workflow) =>
          workflow.run(() =>
            run(() =>
              workflow.body(async () => {
                const english = locale === "en-us";
                await page.setViewportSize({ width, height: 844 });
                await page.context().addCookies([
                  {
                    ...(await createSignedDemoCookie({
                      issuedAt: Math.floor(Date.now() / 1000),
                    })),
                    url: isolatedWorker.origin,
                  },
                  {
                    name: "NEXT_LOCALE",
                    value: locale,
                    url: isolatedWorker.origin,
                  },
                ]);
                await gotoAndWaitForReady(page, "/");
                const personal = page.getByTestId("home-personal-overview");
                await expect(personal).toHaveAttribute("aria-busy", "false");
                await expect(page.getByTestId("demo-notice")).toBeVisible();
                await expect(page.getByTestId("home-sign-in")).toHaveCount(0);
                await expect(personal).toContainText(
                  english ? "Linear Algebra" : "线性代数",
                );
                await expect(personal).toContainText(
                  english ? "Review linear algebra" : "预习线性代数",
                );
                await expect(personal).toContainText(
                  english ? "Vector spaces exercises" : "向量空间练习",
                );
                for (const module of [
                  "notices",
                  "activities",
                  "weather",
                  "bus",
                ])
                  await expect(
                    page.getByTestId(`home-${module}`),
                  ).toHaveAttribute("aria-busy", "false");
                for (const module of ["notices", "activities"]) {
                  const rows = page
                    .getByTestId(`home-${module}`)
                    .locator('[data-slot="item"]');
                  await expect(rows).toHaveCount(5);
                  await expect(rows.filter({ visible: true })).toHaveCount(
                    width === 390 ? 3 : 5,
                  );
                  await expect(
                    page.getByTestId(`home-${module}`).locator("a[href]"),
                  ).toHaveCount(0);
                  await expect(
                    page
                      .getByTestId(`home-${module}`)
                      .locator('[data-slot="item"][aria-disabled="true"]'),
                  ).toHaveCount(5);
                  for (const row of await rows.filter({ visible: true }).all())
                    await expectReadable(row);
                }
                await expect(page.getByTestId("home-weather")).toContainText(
                  english ? "Fictional" : "虚构",
                );
                await expect(page.getByTestId("home-bus")).toContainText(
                  english ? "Not a real timetable" : "非真实时刻表",
                );
                await expect(page.getByTestId("home-bus")).toContainText(
                  "09:05",
                );
                await expect(page.getByTestId("home-bus")).toContainText(
                  english ? "In 5 min" : "5 分钟后",
                );
                for (const id of [
                  "demo-notice",
                  "demo-home-samples",
                  "home-weather",
                  "home-bus",
                  "overview-focus-title",
                ])
                  await expectReadable(page.getByTestId(id));
                for (const id of ["home-notices", "home-activities"])
                  await expect(
                    page.getByTestId(id).locator("a[href]"),
                  ).toHaveCount(0);
                for (const family of ["weather", "bus"])
                  await expect(
                    page
                      .getByTestId(`home-${family}`)
                      .locator(`a[href="/catalog/${family}"]`),
                  ).toHaveCount(1);
                const directory = page.locator("[data-feature-directory]");
                await expect(
                  directory.locator('a[href="/catalog/sections"]'),
                ).toHaveCount(1);
                await expect(
                  directory.locator('a[href="/catalog/courses"]'),
                ).toHaveCount(1);
                await expect(
                  directory.locator('a[href="/catalog/teachers"]'),
                ).toHaveCount(1);
                await expect(
                  directory.locator('a[href="/workspace/calendar"]'),
                ).toHaveCount(1);
                await expect(
                  directory.locator('[aria-disabled="true"]'),
                ).not.toHaveCount(0);
                await expect(
                  directory.locator(
                    'a[href="/catalog/links"], a[href="/news"], a[href="/catalog/young-events"]',
                  ),
                ).toHaveCount(0);
                for (const href of ["/catalog/weather", "/catalog/bus"])
                  await expect(
                    directory.locator(`a[href="${href}"]`),
                  ).toHaveCount(1);
                await expectReadable(
                  directory.locator(`#home-feature-search-demo-unavailable`),
                );
                await directory
                  .locator('input[type="search"]')
                  .fill(english ? "Courses" : "课程");
                await expect(
                  directory.locator('a[href="/catalog/courses"]'),
                ).toBeVisible();
                await directory.locator('input[type="search"]').fill("");
                await directory.locator('a[href="/catalog/sections"]').click();
                await expect(page).toHaveURL(/\/catalog\/sections$/);
                await waitForUiSettled(page);
                await expect(page.getByTestId("demo-notice")).toBeVisible();
                await gotoAndWaitForReady(page, "/");
                await expect(
                  page.getByTestId("home-personal-overview"),
                ).toHaveAttribute("aria-busy", "false");
                await expect(
                  page.getByTestId("home-campus-now"),
                ).toHaveAttribute("aria-busy", "false");
                await expectNoPageHorizontalOverflow(page);
                await expectRenderedUiQuality(page);
                await page.evaluate(() => document.fonts.ready);
                await page
                  .locator("[data-shell-scroll-container]")
                  .evaluate((element) => {
                    element.scrollTop = 0;
                  });
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.screenshot({
                  path: testInfo.outputPath(
                    `after-home-${locale}-${width}.png`,
                  ),
                  fullPage: true,
                });
              }),
            ),
          ),
        );
      },
    );
  }

test("demo.home: exit and re-entry cannot restore a held previous overview", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await page.context().addCookies([
            {
              ...(await createSignedDemoCookie({
                issuedAt: Math.floor(Date.now() / 1000) - 60,
              })),
              url: isolatedWorker.origin,
            },
            { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
          ]);
          const release = createDeferred();
          const captured = createDeferred();
          void captured.promise.catch(() => undefined);
          const operations: Promise<void>[] = [];
          const errors: unknown[] = [];
          let hold = true;
          let oldExpiry = 0;
          let oldCaptures = 0;
          let oldCallbacksSettled = 0;
          const originalDocument = crypto.randomUUID();
          const currentDocument = crypto.randomUUID();
          const pattern = /\/_internal\/home\/viewer(?:\?|$)/;
          const handler = (route: Route) => {
            const operation = (async () => {
              if (!hold) return route.continue();
              const response = await route.fetch();
              expect(response.status()).toBe(200);
              const body = await response.json();
              expect(body.navStats.user.id).toBe("demo:workspace-v1");
              oldCaptures++;
              oldExpiry = body.demo.expiresAt;
              captured.resolve();
              await release.promise;
              await fulfillUnlessAborted(route, response);
              oldCallbacksSettled++;
            })();
            operations.push(
              operation.catch((error: unknown) => {
                errors.push(error);
                captured.reject(error);
              }),
            );
            return operation;
          };
          const closing = () => {
            hold = false;
            release.resolve();
            captured.reject(new Error("Home workflow closed before capture"));
          };
          try {
            page.on("close", closing);
            await page.route(pattern, handler);
            await page.goto("/", { waitUntil: "domcontentloaded" });
            await page.waitForFunction(
              () =>
                document.documentElement.dataset.lifeUstcHydrated === "true",
            );
            await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
            await expect(page.getByTestId("demo-home-samples")).toBeVisible();
            await captured.promise;
            await page.evaluate((marker) => {
              (
                window as typeof window & { demoHomeDocument?: string }
              ).demoHomeDocument = marker;
            }, originalDocument);
            await expect(
              page.getByTestId("home-personal-overview"),
            ).toHaveAttribute("aria-busy", "true");
            await page
              .getByRole("button", { name: "Exit demo", exact: true })
              .click();
            await expect(page).toHaveURL(/\/account\/sign-in$/);
            expect(
              await page.evaluate(
                () =>
                  (window as typeof window & { demoHomeDocument?: string })
                    .demoHomeDocument,
              ),
            ).toBeUndefined();
            hold = false;
            await page.goBack({ waitUntil: "domcontentloaded" });
            await waitForUiSettled(page);
            await expect(page.getByTestId("demo-notice")).toHaveCount(0);
            await expect(
              page.getByTestId("home-personal-overview"),
            ).toHaveCount(0);
            await gotoAndWaitForReady(page, "/account/sign-in");
            await page
              .getByRole("button", { name: "Enter demo", exact: true })
              .click();
            await expect(page).toHaveURL(/\/workspace\/todos$/);
            await gotoAndWaitForReady(page, "/");
            await expect(
              page.getByTestId("home-personal-overview"),
            ).toHaveAttribute("aria-busy", "false");
            const current = await (
              await page.request.get("/_internal/home/viewer")
            ).json();
            expect(current.demo.expiresAt).toBeGreaterThan(oldExpiry);
            expect(
              await page.evaluate(
                () =>
                  (window as typeof window & { demoHomeDocument?: string })
                    .demoHomeDocument,
              ),
            ).toBeUndefined();
            await page.evaluate((marker) => {
              (
                window as typeof window & { demoHomeDocument?: string }
              ).demoHomeDocument = marker;
            }, currentDocument);
            release.resolve();
            await Promise.all(operations);
            expect(errors).toEqual([]);
            expect(oldCaptures).toBeGreaterThan(0);
            expect(oldCallbacksSettled).toBe(oldCaptures);
            // A retired document need not emit a page-level network terminal event.
            // The actual fulfillment callbacks are joined; the new document stays current.
            expect(
              await page.evaluate(
                () =>
                  (window as typeof window & { demoHomeDocument?: string })
                    .demoHomeDocument,
              ),
            ).toBe(currentDocument);
            await expect(page.getByTestId("demo-notice")).toBeVisible();
            await expect(
              page.getByTestId("home-personal-overview"),
            ).toContainText("Linear Algebra");
            await expect(page.locator("#app-user-menu")).toHaveCount(0);
          } catch (error) {
            errors.push(error);
          } finally {
            hold = false;
            release.resolve();
            captured.reject(new Error("Home workflow finished before capture"));
            if (!page.isClosed())
              await page
                .unroute(pattern, handler)
                .catch((error: unknown) => errors.push(error));
            await Promise.all(operations);
            page.off("close", closing);
          }
          if (errors.length === 1) throw errors[0];
          if (errors.length)
            throw new AggregateError(
              errors,
              "Home exit and re-entry workflow failed",
            );
        }),
      ),
    ),
  );
});
