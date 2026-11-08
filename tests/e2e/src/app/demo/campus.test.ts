import {
  expect,
  type Locator,
  type Request,
  type Route,
} from "@playwright/test";
import { arrangeBusTimetable } from "../../../../shared/bus-timetable";
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
async function expectTextFits(locator: Locator) {
  await expect(locator).toBeVisible();
  await locator.evaluate(() => document.fonts.ready);
  await locator.scrollIntoViewIfNeeded();
  const facts = await locator.evaluate((root) => {
    const failures: unknown[] = [];
    let rectangles = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        rectangles++;
        const box = root.getBoundingClientRect();
        if (
          rect.left < box.left ||
          rect.right > box.right ||
          rect.top < box.top ||
          rect.bottom > box.bottom ||
          rect.left < 0 ||
          rect.right > document.documentElement.clientWidth ||
          rect.top < 0 ||
          rect.bottom > innerHeight
        )
          failures.push({
            text: node.textContent,
            rect: rect.toJSON(),
            box: box.toJSON(),
          });
        for (
          let element = node.parentElement;
          element;
          element = element.parentElement
        ) {
          const style = getComputedStyle(element),
            clip = element.getBoundingClientRect();
          if (
            (/^(hidden|clip|auto|scroll)$/.test(style.overflowX) &&
              (rect.left <
                clip.left + Number.parseFloat(style.borderLeftWidth) ||
                rect.right >
                  clip.right - Number.parseFloat(style.borderRightWidth))) ||
            (/^(hidden|clip|auto|scroll)$/.test(style.overflowY) &&
              (rect.top < clip.top + Number.parseFloat(style.borderTopWidth) ||
                rect.bottom >
                  clip.bottom - Number.parseFloat(style.borderBottomWidth)))
          )
            failures.push({
              text: node.textContent,
              rect: rect.toJSON(),
              clip: clip.toJSON(),
            });
        }
      }
    }
    return { rectangles, failures };
  });
  expect(facts.rectangles).toBeGreaterThan(0);
  expect(facts.failures).toEqual([]);
}
const storageKey = "life-ustc:recent-bus-route:v1";
const scenes = [
  { family: "weather", locale: "en-us", width: 1280 },
  { family: "weather", locale: "zh-cn", width: 390 },
  { family: "bus", locale: "en-us", width: 390 },
  { family: "bus", locale: "zh-cn", width: 1280 },
  { family: "bus/map", locale: "en-us", width: 1280 },
  { family: "bus/map", locale: "zh-cn", width: 390 },
] as const;
for (const { family, locale, width } of scenes) {
  test(`demo campus: ${family} ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            await page.setViewportSize({ width, height: 844 });
            const demo = await createSignedDemoCookie({
              issuedAt: Math.floor(Date.now() / 1000),
            });
            await page.context().addCookies([
              { ...demo, url: isolatedWorker.origin },
              {
                name: "NEXT_LOCALE",
                value: locale,
                url: isolatedWorker.origin,
              },
            ]);
            await page.addInitScript((key) => {
              const storage = Storage.prototype;
              const get = storage.getItem,
                set = storage.setItem,
                remove = storage.removeItem;
              set.call(
                localStorage,
                key,
                '{"startCampusId":1,"endCampusId":2}',
              );
              const audit: string[] = [];
              Object.assign(window, {
                demoCampusStorageAudit: audit,
                demoCampusReadOriginal: () => get.call(localStorage, key),
              });
              storage.getItem = function (name) {
                if (this === localStorage && name === key) audit.push("get");
                return get.call(this, name);
              };
              storage.setItem = function (name, value) {
                if (this === localStorage && name === key) audit.push("set");
                return set.call(this, name, value);
              };
              storage.removeItem = function (name) {
                if (this === localStorage && name === key) audit.push("remove");
                return remove.call(this, name);
              };
            }, storageKey);
            const preferenceRequests: string[] = [];
            const observe = (request: import("@playwright/test").Request) => {
              if (
                new URL(request.url()).pathname ===
                "/api/workspace/bus-preferences"
              )
                preferenceRequests.push(request.method());
            };
            page.on("request", observe);
            try {
              await gotoAndWaitForReady(page, `/catalog/${family}`);
              await expect(page.getByTestId("demo-notice")).toBeVisible();
              await expect(
                page.getByTestId("demo-campus-fictional"),
              ).toContainText(locale === "en-us" ? "Fictional" : "虚构");
              await expect(
                page.getByTestId("demo-campus-fictional"),
              ).toContainText(
                locale === "en-us" ? "Not live weather" : "非实时天气",
              );
              if (family === "weather") {
                if (width === 390) {
                  const tabs = page.getByTestId("weather-campus-tabs");
                  for (const [index, key] of [
                    "ustc-main",
                    "ustc-gaoxin",
                  ].entries()) {
                    await tabs.getByRole("tab").nth(index).click();
                    const location = tabs.locator(
                      '[data-testid="weather-location"]:visible',
                    );
                    await expect(location).toHaveAttribute(
                      "data-weather-location",
                      key,
                    );
                    await expect(
                      location.getByTestId("weather-temperature"),
                    ).toHaveText(index ? "25°" : "24°");
                    await expect(
                      location.getByTestId("weather-hourly-chart"),
                    ).toBeVisible();
                    await expect(location.locator("ul > li")).toHaveCount(7);
                  }
                  await tabs.getByRole("tab").nth(0).click();
                } else {
                  const grid = page.getByTestId("weather-campus-grid");
                  await expect(
                    grid.getByTestId("weather-temperature"),
                  ).toHaveText(["24°", "25°"]);
                  await expect(
                    grid.getByTestId("weather-hourly-chart"),
                  ).toHaveCount(2);
                  await expect(grid.locator("ul > li")).toHaveCount(14);
                }
                await expect(
                  page.getByTestId("weather-page-meta"),
                ).toContainText("09:00");
                await expect(
                  page.getByTestId("weather-page-meta"),
                ).not.toContainText(/AMap|Open-Meteo/);
              } else if (family === "bus") {
                const summary = page.getByTestId("bus-compact-summary");
                await expect(summary).toContainText("09:05");
                await page
                  .getByRole("button", { name: /Change route|调整路线/ })
                  .click();
                const destination = page.getByTestId("bus-end-stop-group");
                await expect(destination.getByRole("radio")).toHaveCount(6);
                for (const option of await destination.getByRole("radio").all())
                  await expectTextFits(option);
                if (locale === "en-us" && width === 390) {
                  await page
                    .getByTestId("bus-start-stop-group")
                    .scrollIntoViewIfNeeded();
                  await page.screenshot({
                    path: "/tmp/life1532-after-bus-en-us-390-picker.png",
                    fullPage: false,
                  });
                }
                await destination
                  .getByRole("radio", {
                    name:
                      locale === "en-us"
                        ? "Sample destination 2"
                        : "虚构目的地 2",
                    exact: true,
                  })
                  .click();
                await page.keyboard.press("Escape");
                await page
                  .getByRole("button", { name: /Apply filters|应用筛选/ })
                  .click();
                await expect(summary).toContainText("09:20");
                await expect(summary).toContainText(
                  locale === "en-us" ? "Sample destination 2" : "虚构目的地 2",
                );
                expect(
                  await page.evaluate(
                    () =>
                      (
                        window as typeof window & {
                          demoCampusStorageAudit: string[];
                        }
                      ).demoCampusStorageAudit,
                  ),
                ).toEqual([]);
                await page.reload();
                await waitForUiSettled(page);
                await expect(
                  page.getByTestId("bus-compact-summary"),
                ).toContainText("09:05");
              } else {
                const svg = page.locator('svg[role="img"]');
                await expect(svg).toBeVisible();
                await expect(svg.locator("[data-campus-label]")).toHaveCount(6);
                expect(await svg.locator("image").count()).toBe(0);
                const labels = await svg
                  .locator("[data-campus-label]")
                  .evaluateAll((nodes) =>
                    nodes.map((node) => ({
                      text: node.textContent?.trim(),
                      height: node.getBoundingClientRect().height,
                      rect: node.getBoundingClientRect().toJSON(),
                      canvas:
                        node instanceof SVGElement
                          ? node.ownerSVGElement
                              ?.getBoundingClientRect()
                              .toJSON()
                          : undefined,
                    })),
                  );
                expect(
                  labels.every(
                    ({ text, height }) => Boolean(text) && height >= 10,
                  ),
                ).toBe(true);
                for (const label of labels) {
                  expect(label.canvas).toBeDefined();
                  if (!label.canvas)
                    throw new Error("Map label has no SVG viewport");
                  expect(label.rect.left).toBeGreaterThanOrEqual(
                    label.canvas.left,
                  );
                  expect(label.rect.right).toBeLessThanOrEqual(
                    label.canvas.right,
                  );
                  expect(label.rect.top).toBeGreaterThanOrEqual(
                    label.canvas.top,
                  );
                  expect(label.rect.bottom).toBeLessThanOrEqual(
                    label.canvas.bottom,
                  );
                }
                const before = await svg
                  .locator("[data-campus-label]")
                  .allTextContents();
                await page
                  .getByRole("button", { name: /Refresh|刷新/ })
                  .click();
                await waitForUiSettled(page);
                await expect(svg.locator("[data-campus-label]")).toHaveText(
                  before,
                );
                await expect(
                  page.locator('iframe, img[src^="http"], image'),
                ).toHaveCount(0);
              }
              await expectTextFits(page.getByTestId("demo-campus-fictional"));
              await expectNoPageHorizontalOverflow(page);
              await expectRenderedUiQuality(page);
              expect(preferenceRequests).toEqual([]);
              expect(
                await page.evaluate(() => {
                  const target = window as typeof window & {
                    demoCampusStorageAudit: string[];
                    demoCampusReadOriginal: () => string | null;
                  };
                  return {
                    accesses: target.demoCampusStorageAudit,
                    value: target.demoCampusReadOriginal(),
                  };
                }),
              ).toEqual({
                accesses: [],
                value: '{"startCampusId":1,"endCampusId":2}',
              });
              await page
                .getByRole("heading", { level: 1 })
                .scrollIntoViewIfNeeded();
              await page.screenshot({
                path: `/tmp/life1532-after-${family.replaceAll("/", "-")}-${locale}-${width}.png`,
                fullPage: true,
              });
            } finally {
              page.off("request", observe);
            }
          }),
        ),
      ),
    );
  });
}

test("demo campus: same-page mode change discards held ordinary bus preferences", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await arrangeBusTimetable(isolatedWorker.database.owner);
          const actor = await isolatedWorker.createActor();
          await isolatedWorker.database.owner.busUserPreference.create({
            data: {
              userId: actor.id,
              preferredOriginCampusId: 1,
              preferredDestinationCampusId: 4,
              showDepartedTrips: true,
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
          let held: Request | undefined;
          let terminal: "finished" | "failed" | undefined;
          const operations: Promise<void>[] = [];
          const errors: unknown[] = [];
          const onFinished = (request: Request) => {
            if (request === held) terminal = "finished";
          };
          const onFailed = (request: Request) => {
            if (request === held) terminal = "failed";
          };
          const closing = () => {
            release.resolve();
            captured.reject(
              new Error("Bus closed before ordinary preference capture"),
            );
          };
          const handler = (route: Route) => {
            const operation = (async () => {
              const response = await route.fetch({ maxRedirects: 0 });
              expect(response.status()).toBe(200);
              const body = await response.json();
              expect(body.preference).toEqual({
                preferredOriginCampusId: 1,
                preferredDestinationCampusId: 4,
                showDepartedTrips: true,
              });
              if (held)
                throw new Error(
                  "Unexpected duplicate ordinary preference read",
                );
              held = route.request();
              captured.resolve();
              await release.promise;
              await route.fulfill({ response }).catch((error: unknown) => {
                if (route.request().failure()?.errorText !== "net::ERR_ABORTED")
                  throw error;
              });
            })();
            operations.push(operation);
            void operation.catch((error: unknown) => {
              errors.push(error);
              captured.reject(error);
            });
            return operation;
          };
          const pattern = "**/api/workspace/bus-preferences";
          try {
            page.on("requestfinished", onFinished);
            page.on("requestfailed", onFailed);
            page.on("close", closing);
            await page.route(pattern, handler);
            await page.goto("/catalog/bus", { waitUntil: "domcontentloaded" });
            await page.waitForFunction(
              () =>
                document.documentElement.dataset.lifeUstcHydrated === "true",
            );
            await captured.promise;
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "Shuttle Bus",
            );
            await page.evaluate(() => {
              Object.assign(window, {
                demoCampusModeMarker: {
                  heading: document.querySelector("#main-content h1"),
                  leak: false,
                },
              });
            });
            await page.context().clearCookies();
            const demo = await createSignedDemoCookie({
              issuedAt: Math.floor(Date.now() / 1000),
            });
            await page.context().addCookies([
              { ...demo, url: isolatedWorker.origin },
              {
                name: "NEXT_LOCALE",
                value: "en-us",
                url: isolatedWorker.origin,
              },
            ]);
            const link = page.locator(
              '[data-shell-navigation="desktop"] a[data-slot="sidebar-menu-button"][href="/catalog/bus"]',
            );
            await expect(link).toHaveCount(1);
            await link.click();
            await expect(
              page.getByTestId("demo-campus-fictional"),
            ).toBeVisible();
            await expect(page.getByTestId("bus-compact-summary")).toContainText(
              "09:05",
            );
            expect(
              await page.evaluate(() => {
                const state = window as typeof window & {
                  demoCampusModeMarker?: { heading: Element | null };
                };
                return Boolean(
                  state.demoCampusModeMarker &&
                    state.demoCampusModeMarker.heading ===
                      document.querySelector("#main-content h1"),
                );
              }),
            ).toBe(true);
            await page
              .getByRole("button", { name: "Change route", exact: true })
              .click();
            const departedFlag = page.locator(
              "#bus-settings-show-departed-trips",
            );
            await expect(departedFlag).toBeVisible();
            await expect(departedFlag).toHaveAttribute("aria-checked", "false");
            for (const option of await page
              .getByTestId("bus-end-stop-group")
              .getByRole("radio")
              .all())
              await expectTextFits(option);
            await page.evaluate(() => {
              const state = window as typeof window & {
                demoCampusModeMarker: {
                  heading: Element | null;
                  leak: boolean;
                  observer?: MutationObserver;
                };
              };
              const observer = new MutationObserver((records) => {
                const planner = document.querySelector(
                  '[data-testid="bus-responsive-planner"]',
                );
                const flag = document.querySelector(
                  "#bus-settings-show-departed-trips",
                );
                if (
                  planner?.textContent?.includes("南区") ||
                  flag?.getAttribute("aria-checked") === "true" ||
                  records.some(
                    (record) =>
                      record.type === "attributes" &&
                      (record.target as Element).id ===
                        "bus-settings-show-departed-trips" &&
                      record.oldValue === "true",
                  )
                )
                  state.demoCampusModeMarker.leak = true;
              });
              state.demoCampusModeMarker.observer = observer;
              observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ["aria-checked"],
                attributeOldValue: true,
              });
            });
            release.resolve();
            await Promise.all(operations);
            expect(errors).toEqual([]);
            await expect.poll(() => terminal).toMatch(/finished|failed/);
            expect(operations).toHaveLength(1);
            if (terminal === "failed")
              expect(held?.failure()?.errorText).toBe("net::ERR_ABORTED");
            await expect(page.getByTestId("bus-compact-summary")).toContainText(
              "Sample Campus",
            );
            await expect(page.getByTestId("bus-compact-summary")).toContainText(
              "09:05",
            );
            if (
              !(await page
                .getByRole("dialog", { name: "Change route", exact: true })
                .isVisible())
            )
              await page
                .getByRole("button", { name: "Change route", exact: true })
                .click();
            await expect(departedFlag).toBeVisible();
            await expect(departedFlag).toHaveAttribute("aria-checked", "false");
            const stops = page.getByTestId("bus-end-stop-group");
            await expect(
              stops.getByRole("radio", {
                name: "Sample destination 1",
                exact: true,
              }),
            ).toHaveAttribute("aria-checked", "true");
            await expect(
              stops.getByRole("radio", { name: "南区", exact: true }),
            ).toHaveCount(0);
            expect(
              await page.evaluate(() => {
                const state = window as typeof window & {
                  demoCampusModeMarker: {
                    leak: boolean;
                    observer?: MutationObserver;
                  };
                };
                state.demoCampusModeMarker.observer?.disconnect();
                return state.demoCampusModeMarker.leak;
              }),
            ).toBe(false);
            expect(
              await isolatedWorker.database.owner.busUserPreference.findUnique({
                where: { userId: actor.id },
                select: {
                  preferredOriginCampusId: true,
                  preferredDestinationCampusId: true,
                  showDepartedTrips: true,
                },
              }),
            ).toEqual({
              preferredOriginCampusId: 1,
              preferredDestinationCampusId: 4,
              showDepartedTrips: true,
            });
            await page.keyboard.press("Escape");
            const localeChange = await page.request.post(
              "/api/account/preferences",
              {
                headers: { origin: isolatedWorker.origin },
                data: { locale: "zh-cn" },
              },
            );
            expect(localeChange.status()).toBe(200);
            expect(await localeChange.json()).toEqual({ success: true });
            await link.click();
            await expect(page.getByTestId("bus-compact-summary")).toContainText(
              "虚构样例校区",
            );
            await expect(
              page.getByTestId("bus-compact-summary"),
            ).not.toContainText("Sample Campus");
            await expect(page.getByTestId("bus-compact-summary")).toContainText(
              "09:05",
            );
            await page
              .getByTestId("demo-notice")
              .locator("form")
              .getByRole("button")
              .click();
            await expect(page).toHaveURL(/\/account\/sign-in(?:[?#].*)?$/);
            await page.goBack();
            await waitForUiSettled(page);
            await expect(page.getByTestId("demo-notice")).toHaveCount(0);
            await expect(page.getByTestId("demo-campus-fictional")).toHaveCount(
              0,
            );
            await expect(page.locator("#main-content")).not.toContainText(
              "Sample Campus",
            );
            await expect(page.locator("#main-content")).not.toContainText(
              "虚构样例校区",
            );
          } catch (error) {
            if (!errors.includes(error)) errors.push(error);
          } finally {
            release.resolve();
            captured.reject(new Error("Bus mode control ended"));
            try {
              await page.unroute(pattern, handler);
            } catch (error) {
              if (!errors.includes(error)) errors.push(error);
            }
            await Promise.allSettled(operations);
            page.off("close", closing);
            page.off("requestfinished", onFinished);
            page.off("requestfailed", onFailed);
          }
          if (errors.length)
            throw new AggregateError(
              errors,
              "Held ordinary bus preference workflow failed",
            );
        }),
      ),
    ),
  );
});
