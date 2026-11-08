import {
  expect,
  type Locator,
  type Page,
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

test.use({
  workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" },
  workerOutboundJson: [
    {
      url: "https://static.life-ustc.tiankaima.dev/room_maps.json",
      json: {
        rooms: [
          {
            code: "DEMO-101",
            building: "Owned ordinary building",
            floor: "1",
            imagePath: "imgs/ordinary-1544.png",
            sourceImagePath: "imgs/ordinary-1544-floor.png",
          },
        ],
      },
    },
    {
      url: "https://static.life-ustc.tiankaima.dev/building_img_rules.json",
      json: [],
    },
  ],
});
const highlighted = "/api/catalog/rooms/images/demo-room-101.svg";
const base = "/api/catalog/rooms/images/demo-floor.svg";
const preview = (page: Page) =>
  page.getByTestId("room-map-preview").filter({ visible: true });
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function imageReady(image: Locator) {
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0 &&
          image.naturalHeight > 0,
      ),
    )
    .toBe(true);
}
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

for (const [locale, width] of [
  ["en-us", 1280],
  ["en-us", 390],
  ["zh-cn", 390],
] as const) {
  test(`demo rooms: fixed directory, map statuses and zoom ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            const en = locale === "en-us";
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
            const response = await gotoAndWaitForReady(page, "/catalog/rooms");
            expect(response?.status()).toBe(200);
            await expect(page.getByTestId("demo-notice")).toBeVisible();
            await expect(page.locator("#main-content")).toContainText(
              en
                ? "not the university’s actual buildings"
                : "不代表学校真实建筑",
            );
            const chips = page.getByTestId("room-map-sample-chip");
            await expect(chips).toHaveText(["DEMO-101", "DEMO-1", "DEMO-NONE"]);
            const directory = page.getByTestId("room-map-building-index");
            await expect(
              directory.getByRole("button", {
                name: en ? "Fictional sample campus" : "虚构样例校区",
                exact: true,
              }),
            ).toBeVisible();
            await chips.filter({ hasText: /^DEMO-101$/ }).click();
            await waitForUiSettled(page);
            await expect(page).toHaveURL(/room=DEMO-101$/);
            const result = preview(page);
            await expect(result).toHaveCount(1);
            await expect(result).toContainText(
              en ? "Room highlighted" : "已标注教室",
            );
            await expect(result).toContainText(
              en ? "Fictional teaching building" : "虚构教学楼",
            );
            const image = result.getByRole("img");
            await expect(image).toHaveAttribute("src", highlighted);
            await imageReady(image);
            await expect(
              directory.getByTestId("room-map-building-room"),
            ).toHaveText("DEMO-101");
            await expect(
              directory.getByTestId("room-map-building-room"),
            ).toHaveAttribute("aria-current", "location");
            const source = result.getByRole("link", {
              name: en ? "View source floor map" : "查看原始楼层图",
              exact: true,
            });
            await expect(source).toHaveAttribute("href", base);
            const sourceResponse = await page.request.get(base);
            expect(sourceResponse.status()).toBe(200);
            expect(sourceResponse.headers()["content-type"]).toContain(
              "image/svg+xml",
            );
            expect(await sourceResponse.text()).toContain(
              "FICTIONAL SCHEMATIC",
            );
            await image.scrollIntoViewIfNeeded();
            await expectNoPageHorizontalOverflow(page);
            await expectRenderedUiQuality(page);
            if (width === 390) {
              await page.locator("#main-content").focus();
              await page.keyboard.press("Control+Home");
              await expect
                .poll(() =>
                  page.evaluate(() => ({
                    document: document.scrollingElement?.scrollTop ?? 0,
                    regions: [
                      ...document.querySelectorAll(
                        "[data-shell-scroll-container]",
                      ),
                    ].map((node) => node.scrollTop),
                  })),
                )
                .toEqual({ document: 0, regions: [0] });
            }
            if (locale === "zh-cn" || width === 1280)
              await page.screenshot({
                path: `/tmp/life1544-after-rooms-${locale}-${width}.png`,
                fullPage: width === 390,
              });
            await result
              .getByRole("button", {
                name: en ? "Open map" : "放大地图",
                exact: true,
              })
              .click();
            const dialog = page.getByTestId("room-map-dialog");
            await expect(dialog).toBeVisible();
            await imageReady(dialog.getByRole("img"));
            const scroll = dialog.getByTestId("room-map-scroll");
            await dialog
              .getByRole("button", {
                name: en ? "Zoom in" : "放大",
                exact: true,
              })
              .click();
            await expect
              .poll(() =>
                scroll.evaluate(
                  (element) => element.scrollWidth > element.clientWidth,
                ),
              )
              .toBe(true);
            await dialog
              .getByRole("button", {
                name: en ? "Reset zoom" : "重置缩放",
                exact: true,
              })
              .click();
            await expect(
              dialog.getByRole("button", {
                name: en ? "Reset zoom" : "重置缩放",
                exact: true,
              }),
            ).toBeDisabled();
            await dialog
              .getByRole("button", {
                name: en ? "Zoom out" : "缩小",
                exact: true,
              })
              .click();
            await expect(
              dialog.getByRole("button", {
                name: en ? "Zoom out" : "缩小",
                exact: true,
              }),
            ).toBeDisabled();
            await dialog
              .getByRole("button", {
                name: en ? "Reset zoom" : "重置缩放",
                exact: true,
              })
              .click();
            await expect(
              dialog.getByRole("link", {
                name: en ? "Open map" : "放大地图",
                exact: true,
              }),
            ).toHaveAttribute("href", highlighted);
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
            const input = page.locator("#room-map-code");
            await input.fill(" ｄｅｍｏ－１ ");
            await page
              .getByRole("button", {
                name: en ? "Look up" : "查询",
                exact: true,
              })
              .click();
            await waitForUiSettled(page);
            await expect(input).toHaveValue("DEMO-1");
            await expectTextFits(result.locator("p").first());
            await expectTextFits(result.locator('[data-slot="badge"]'));
            await expectNoPageHorizontalOverflow(page);
            await expect(result).toContainText(
              en ? "Floor overview only" : "仅有楼层概览",
            );
            await expect(result.getByRole("img")).toHaveAttribute("src", base);
            await imageReady(result.getByRole("img"));
            await input.fill("demo-none");
            await page
              .getByRole("button", {
                name: en ? "Look up" : "查询",
                exact: true,
              })
              .click();
            await waitForUiSettled(page);
            await expect(result).toContainText(
              en
                ? "A map is not available for this room yet."
                : "暂时没有这间教室的地图。",
            );
            await expectTextFits(result.locator("p").first());
            await expectTextFits(result.locator('[data-slot="badge"]'));
            await expectNoPageHorizontalOverflow(page);
            await expect(result.getByRole("img")).toHaveCount(0);
            await expect(result.getByRole("link")).toHaveCount(0);
            await input.fill("demo-101");
            await page
              .getByRole("button", {
                name: en ? "Look up" : "查询",
                exact: true,
              })
              .click();
            await waitForUiSettled(page);
            await imageReady(result.getByRole("img"));
            await expectTextFits(result.locator("p").first());
            const external = page.locator('#main-content a[target="_blank"]');
            for (const link of await external.all())
              expect(await link.getAttribute("href")).toMatch(
                /^\/api\/catalog\/rooms\/images\/demo-(?:floor|room-101)\.svg$/,
              );
          }),
        ),
      ),
    );
  });
}

for (const transition of ["ordinary mode", "same-page locale"] as const) {
  test(`demo rooms: ${transition} retires a real held map for the same code`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            await page.setViewportSize({ width: 1280, height: 844 });
            const initialDemo = await createSignedDemoCookie({
              issuedAt: Math.floor(Date.now() / 1000),
            });
            const actor =
              transition === "ordinary mode"
                ? await isolatedWorker.createActor()
                : null;
            await page.context().addCookies([
              { ...(actor?.cookie ?? initialDemo), url: isolatedWorker.origin },
              {
                name: "NEXT_LOCALE",
                value: "en-us",
                url: isolatedWorker.origin,
              },
            ]);
            const captured = createDeferred(),
              release = createDeferred();
            void captured.promise.catch(() => undefined);
            const operations: Promise<void>[] = [],
              errors: unknown[] = [];
            let held: Request | undefined,
              terminal: "finished" | "failed" | undefined;
            const finished = (request: Request) => {
              if (request === held) terminal = "finished";
            };
            const failed = (request: Request) => {
              if (request === held) terminal = "failed";
            };
            const closing = () => {
              release.resolve();
              captured.reject(
                new Error("Room owner control closed before capture"),
              );
            };
            const pattern = "**/api/catalog/rooms/DEMO-101/map";
            const handler = (route: Route) => {
              const operation = (async () => {
                const response = await route.fetch({ maxRedirects: 0 });
                expect(response.status()).toBe(200);
                const body: unknown = await response.json();
                if (!isRecord(body))
                  throw new Error("Expected real room map object");
                expect(body).toMatchObject({
                  code: "DEMO-101",
                  status: "highlighted",
                });
                if (!held) {
                  expect(body.building).toBe(
                    transition === "ordinary mode"
                      ? "Owned ordinary building"
                      : "Fictional teaching building",
                  );
                  expect(body.imageUrl).toBe(
                    transition === "ordinary mode"
                      ? "https://static.life-ustc.tiankaima.dev/imgs/ordinary-1544.png"
                      : highlighted,
                  );
                  held = route.request();
                  captured.resolve();
                  await release.promise;
                } else
                  expect(body).toMatchObject({
                    building:
                      transition === "same-page locale"
                        ? "虚构教学楼"
                        : "Fictional teaching building",
                    imageUrl: highlighted,
                  });
                await route.fulfill({ response }).catch((error: unknown) => {
                  if (
                    route.request().failure()?.errorText !== "net::ERR_ABORTED"
                  )
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
            try {
              page.on("close", closing);
              page.on("requestfinished", finished);
              page.on("requestfailed", failed);
              await page.route(pattern, handler);
              await page.goto("/catalog/rooms?room=DEMO-101", {
                waitUntil: "domcontentloaded",
              });
              await expect(page.locator("html")).toHaveAttribute(
                "data-life-ustc-hydrated",
                "true",
              );
              await captured.promise;
              await page.evaluate(() =>
                Object.assign(window, {
                  demoRoomOwner: {
                    heading: document.querySelector("#main-content h1"),
                    preview: document.querySelector(
                      '[data-testid="room-map-preview"]',
                    ),
                  },
                }),
              );
              if (transition === "ordinary mode") {
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
              } else
                await page.context().addCookies([
                  {
                    name: "NEXT_LOCALE",
                    value: "zh-cn",
                    url: isolatedWorker.origin,
                  },
                ]);
              const current = page
                .getByTestId("room-map-building-room")
                .filter({ hasText: /^DEMO-101$/ });
              await expect(current).toHaveCount(1);
              await current.click();
              await expect(page.getByTestId("demo-notice")).toBeVisible();
              await imageReady(preview(page).getByRole("img"));
              await expect(preview(page)).toContainText(
                transition === "same-page locale"
                  ? "虚构教学楼"
                  : "Fictional teaching building",
              );
              expect(
                await page.evaluate(() => {
                  const state = window as typeof window & {
                    demoRoomOwner?: {
                      heading: Element | null;
                      preview: Element | null;
                    };
                  };
                  return Boolean(
                    state.demoRoomOwner &&
                      state.demoRoomOwner.heading ===
                        document.querySelector("#main-content h1") &&
                      state.demoRoomOwner.preview ===
                        document.querySelector(
                          '[data-testid="room-map-preview"]',
                        ),
                  );
                }),
              ).toBe(true);
              const oldText =
                transition === "ordinary mode"
                  ? "Owned ordinary building"
                  : "Fictional teaching building";
              await page.evaluate((oldText) => {
                const node = document.querySelector(
                  '[data-testid="room-map-preview"]',
                );
                if (!node) throw new Error("Missing current preview");
                const state = {
                  leak: false,
                  observer: null as MutationObserver | null,
                };
                state.observer = new MutationObserver((records) => {
                  if (
                    node.textContent?.includes(oldText) ||
                    node.querySelector('img[src*="ordinary-1544"]')
                  )
                    state.leak = true;
                  for (const record of records)
                    if (
                      record.oldValue?.includes(oldText) ||
                      record.oldValue?.includes("ordinary-1544")
                    )
                      state.leak = true;
                });
                state.observer.observe(node, {
                  childList: true,
                  subtree: true,
                  characterData: true,
                  characterDataOldValue: true,
                  attributes: true,
                  attributeOldValue: true,
                  attributeFilter: ["src"],
                });
                Object.assign(window, { demoRoomLate: state });
              }, oldText);
              release.resolve();
              await Promise.all(operations);
              await expect.poll(() => terminal).toMatch(/finished|failed/);
              if (terminal === "failed")
                expect(held?.failure()?.errorText).toBe("net::ERR_ABORTED");
              await expect(preview(page)).not.toContainText(oldText);
              await expect(preview(page).getByRole("img")).toHaveAttribute(
                "src",
                highlighted,
              );
              expect(
                await page.evaluate(() => {
                  const state = window as typeof window & {
                    demoRoomLate: { leak: boolean; observer: MutationObserver };
                  };
                  state.demoRoomLate.observer.disconnect();
                  return state.demoRoomLate.leak;
                }),
              ).toBe(false);
            } catch (error) {
              if (!errors.includes(error)) errors.push(error);
            } finally {
              release.resolve();
              captured.reject(new Error("Room owner control ended"));
              try {
                await page.unroute(pattern);
              } catch (error) {
                errors.push(error);
              }
              await Promise.allSettled(operations);
              page.off("close", closing);
              page.off("requestfinished", finished);
              page.off("requestfailed", failed);
            }
            if (errors.length)
              throw new AggregateError(
                errors,
                "Held room map owner workflow failed",
              );
          }),
        ),
      ),
    );
  });
}

test("demo rooms: native locale and re-entry retain the sealed graph", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await page.setViewportSize({ width: 1280, height: 844 });
          await page.context().addCookies([
            {
              ...(await createSignedDemoCookie({
                issuedAt: Math.floor(Date.now() / 1000) - 120,
              })),
              url: isolatedWorker.origin,
            },
            { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
          ]);
          await gotoAndWaitForReady(page, "/catalog/rooms?room=DEMO-101");
          await imageReady(preview(page).getByRole("img"));
          await page.evaluate(() =>
            Object.assign(window, { demoRoomsDocument: true }),
          );
          await page
            .getByRole("button", { name: "Language selector", exact: true })
            .click();
          const [localeResponse] = await Promise.all([
            page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname ===
                  "/api/account/preferences" &&
                response.request().method() === "POST",
            ),
            page
              .getByRole("menuitemradio", { name: "中文", exact: true })
              .click(),
          ]);
          expect(localeResponse.status()).toBe(200);
          await waitForUiSettled(page);
          expect(await page.evaluate(() => "demoRoomsDocument" in window)).toBe(
            false,
          );
          await expect(preview(page)).toContainText("虚构教学楼");
          await imageReady(preview(page).getByRole("img"));
          await page.evaluate(() =>
            Object.assign(window, { demoRoomsExitDocument: true }),
          );
          await page
            .getByRole("button", { name: "退出演示", exact: true })
            .click();
          await expect(page).toHaveURL(/\/account\/sign-in$/);
          await waitForUiSettled(page);
          expect(
            await page.evaluate(() => "demoRoomsExitDocument" in window),
          ).toBe(false);
          await expect(page.getByTestId("room-map-preview")).toHaveCount(0);
          await page
            .getByRole("button", { name: "进入演示", exact: true })
            .click();
          await expect(page).toHaveURL(/\/workspace\/todos$/);
          await gotoAndWaitForReady(page, "/catalog/rooms?room=DEMO-101");
          await expect(preview(page)).toContainText("虚构教学楼");
          await expect(preview(page).getByRole("img")).toHaveAttribute(
            "src",
            highlighted,
          );
          await imageReady(preview(page).getByRole("img"));
        }),
      ),
    ),
  );
});

test("demo rooms: bypasses a proven warm ordinary HTTP cache", {
  tag: "@Account/Web",
}, async ({ page, request, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          const foreign: string[] = [],
            errors: unknown[] = [];
          const record = (incoming: Request) => {
            if (new URL(incoming.url()).origin !== isolatedWorker.origin)
              foreign.push(incoming.url());
          };
          const id = crypto.randomUUID(),
            probe = `/__test/community-effects?id=${id}`;
          const secret = {
            "x-test-storage-secret": "local-test-storage-observer",
          };
          const headers = {
            ...secret,
            "x-test-community-probe": id,
            accept: "application/json",
          };
          const path = "/api/catalog/rooms/DEMO-101/map";
          let registered = false;
          try {
            page.on("request", record);
            const health = await page.goto("/api/health");
            expect(health?.status()).toBe(200);
            if (!health) throw new Error("Missing owned health document");
            expect(health.headers()["content-type"]).toContain("text/plain");
            expect(await health.text()).toBe("ok\n");
            // Remove only this private context's analytics route after proving an
            // inert text document. Demo documents omit analytics entirely.
            await page.context().unrouteAll({ behavior: "wait" });
            const registration = await request.post(probe, { headers: secret });
            expect(registration.status()).toBe(201);
            await registration.body();
            registered = true;
            for (let index = 0; index < 2; index++) {
              const result = await page.evaluate(
                async ({ path, headers }) => {
                  const response = await fetch(path, { headers });
                  return {
                    status: response.status,
                    cacheControl: response.headers.get("cache-control"),
                    vary: response.headers.get("vary"),
                    body: await response.json(),
                  };
                },
                { path, headers },
              );
              expect(result.status).toBe(200);
              expect(result.cacheControl).toBe("public, max-age=300");
              expect(result.vary ?? "").not.toMatch(/cookie/i);
              expect(result.body).toMatchObject({
                code: "DEMO-101",
                building: "Owned ordinary building",
                imageUrl:
                  "https://static.life-ustc.tiankaima.dev/imgs/ordinary-1544.png",
              });
            }
            await expect
              .poll(() =>
                page.evaluate(
                  (path) =>
                    performance.getEntriesByName(
                      new URL(path, location.origin).href,
                    ).length,
                  path,
                ),
              )
              .toBe(2);
            const warm = await page.evaluate((path) => {
              const entry = performance
                .getEntriesByName(new URL(path, location.origin).href)
                .at(-1);
              return entry instanceof PerformanceResourceTiming
                ? {
                    transfer: entry.transferSize,
                    encoded: entry.encodedBodySize,
                  }
                : null;
            }, path);
            if (!warm)
              throw new Error("Missing native HTTP-cache resource timing");
            expect(warm.transfer).toBe(0);
            expect(warm.encoded).toBeGreaterThan(0);
            const observation = await request.get(probe, { headers: secret });
            expect(observation.status()).toBe(200);
            const snapshot: unknown = await observation.json();
            if (
              !isRecord(snapshot) ||
              !Array.isArray(snapshot.requests) ||
              !snapshot.requests.every(isRecord)
            )
              throw new Error("Expected owned Worker request observations");
            const reads = snapshot.requests.filter(
              (item) => isRecord(item.value) && item.value.path === path,
            );
            expect(reads).toHaveLength(1);
            expect(reads[0]).toMatchObject({
              outcome: "fulfilled",
              result: 200,
            });
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
            const document = await gotoAndWaitForReady(
              page,
              "/catalog/rooms?room=DEMO-101",
            );
            if (!document) throw new Error("Missing Demo room document");
            expect(document.status()).toBe(200);
            expect(await document.text()).not.toContain(
              "https://www.googletagmanager.com/gtag/js",
            );
            await expect(preview(page)).toContainText(
              "Fictional teaching building",
            );
            await expect(preview(page)).not.toContainText(
              "Owned ordinary building",
            );
            await expect(preview(page).getByRole("img")).toHaveAttribute(
              "src",
              highlighted,
            );
            await imageReady(preview(page).getByRole("img"));
            await expect
              .poll(() =>
                page.evaluate(
                  (path) =>
                    performance
                      .getEntriesByName(new URL(path, location.origin).href)
                      .filter(
                        (entry) =>
                          entry instanceof PerformanceResourceTiming &&
                          entry.transferSize > 0 &&
                          entry.encodedBodySize > 0,
                      ).length,
                  path,
                ),
              )
              .toBeGreaterThan(0);
          } catch (error) {
            errors.push(error);
          } finally {
            if (!page.isClosed())
              try {
                await page.close();
              } catch (error) {
                errors.push(error);
              }
            if (registered)
              try {
                const deleted = await request.delete(probe, {
                  headers: secret,
                });
                await deleted.body();
                expect(deleted.status()).toBe(204);
              } catch (error) {
                errors.push(error);
              }
            page.off("request", record);
            try {
              expect(foreign).toEqual([]);
            } catch (error) {
              errors.push(error);
            }
          }
          if (errors.length)
            throw new AggregateError(
              errors,
              "Native room map cache isolation failed",
            );
        }),
      ),
    ),
  );
});
