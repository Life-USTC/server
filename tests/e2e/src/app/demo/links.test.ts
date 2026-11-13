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

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const forms = (page: Page) =>
  page
    .locator('form[action="/api/workspace/link-pins"]')
    .filter({ visible: true });
const pin = (page: Page, slug: string) =>
  forms(page)
    .filter({ has: page.locator(`input[name="slug"][value="${slug}"]`) })
    .getByRole("button");
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
  ["zh-cn", 390],
] as const) {
  test(`demo links: fixed directory and Home ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
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
            const writes: string[] = [];
            const request = (request: Request) => {
              if (
                new URL(request.url()).pathname ===
                  "/api/workspace/link-pins" &&
                request.method() !== "GET"
              )
                writes.push(request.method());
            };
            page.on("request", request);
            try {
              const response = await gotoAndWaitForReady(
                page,
                "/catalog/links",
              );
              expect(response?.status()).toBe(200);
              if (!response) throw new Error("Missing directory SSR response");
              const ssr = await page.evaluate(
                (html) => {
                  const document = new DOMParser().parseFromString(
                    html,
                    "text/html",
                  );
                  const forms = [
                    ...document.querySelectorAll(
                      'form[action="/api/workspace/link-pins"]',
                    ),
                  ];
                  return {
                    pins: forms.length,
                    disabled: forms.every(
                      (form) => form.querySelector("button")?.disabled === true,
                    ),
                    pinned: forms
                      .filter(
                        (form) =>
                          form
                            .querySelector('input[name="action"]')
                            ?.getAttribute("value") === "unpin",
                      )
                      .map((form) =>
                        form
                          .querySelector('input[name="slug"]')
                          ?.getAttribute("value"),
                      )
                      .sort(),
                    external: document.querySelectorAll(
                      '#main-content a[href*="/api/catalog/links/resolve"], #main-content a[target="_blank"]',
                    ).length,
                    count: document
                      .querySelector("#main-content")
                      ?.textContent?.includes("12"),
                  };
                },
                await response.text(),
              );
              expect(ssr).toEqual({
                pins: 130,
                disabled: true,
                pinned: ["jw", "jw", "library", "library"],
                external: 0,
                count: true,
              });
              await expect(forms(page)).toHaveCount(65);
              for (const slug of ["jw", "library"]) {
                await expect(pin(page, slug)).toHaveAccessibleName(
                  english ? "Unpin" : "取消置顶",
                );
                await expect(pin(page, slug)).toBeDisabled();
              }
              await expect(pin(page, "mail")).toHaveAccessibleName(
                english ? "Pin" : "置顶",
              );
              await expect(pin(page, "mail")).toBeDisabled();
              expect(
                await forms(page)
                  .getByRole("button")
                  .evaluateAll((buttons) =>
                    buttons.every(
                      (button) => (button as HTMLButtonElement).disabled,
                    ),
                  ),
              ).toBe(true);
              const main = page.locator("#main-content");
              await expect(
                main.locator('a[href*="/api/catalog/links/resolve"]'),
              ).toHaveCount(0);
              await expect(main.locator('a[target="_blank"]')).toHaveCount(0);
              await expect(
                main.getByRole("button", {
                  name: "SmartHypercube/ustclife",
                  exact: true,
                }),
              ).toBeDisabled();
              await expectTextFits(page.getByTestId("demo-links-fictional"));
              const jw = pin(page, "jw").locator("xpath=ancestor::tr[1]");
              if (width === 1280) await expect(jw).toContainText("Visits: 12");
              else
                await expect(
                  pin(page, "jw").locator(
                    'xpath=ancestor::div[contains(@class,"group")][1]',
                  ),
                ).toContainText("访问次数: 12");
              await page
                .getByRole("heading", { level: 1 })
                .scrollIntoViewIfNeeded();
              await page.screenshot({
                path: `/tmp/life1540-after-links-${locale}-${width}.png`,
                fullPage: width === 390,
              });
              await expectNoPageHorizontalOverflow(page);
              await expectRenderedUiQuality(page);
              // Native disabled buttons and submit-handler guards both remain read-only.
              await forms(page)
                .filter({ has: page.locator('input[name="slug"][value="jw"]') })
                .evaluate((form) => (form as HTMLFormElement).requestSubmit());
              await gotoAndWaitForReady(page, "/");
              const overview = page.getByTestId("workspace-overview-links");
              await expect(overview).toBeVisible();
              await expect(
                overview.locator('a[href*="/api/catalog/links/resolve"]'),
              ).toHaveCount(0);
              for (const [slug, count] of [
                ["jw", 12],
                ["library", 7],
                ["mail", 4],
                ["icourse", 2],
              ] as const) {
                const item = overview.locator("form").filter({
                  has: page.locator(`input[name="slug"][value="${slug}"]`),
                });
                await expect(item).toHaveCount(1);
                await expect(item.getByRole("button")).toBeDisabled();
                const row = item.locator(
                  "xpath=ancestor::div[contains(concat(' ',normalize-space(@class),' '),' group ')][1]",
                );
                await expect(row).toContainText(
                  `${english ? "Visits" : "访问次数"}: ${count}`,
                );
              }
              await overview.scrollIntoViewIfNeeded();
              await expectTextFits(overview.getByRole("heading"));
              if (width === 1280)
                await page
                  .getByTestId("home-personal-overview")
                  .evaluate((element) =>
                    element.scrollIntoView({ block: "end" }),
                  );
              else
                await page
                  .getByRole("heading", { level: 1 })
                  .scrollIntoViewIfNeeded();
              await page.screenshot({
                path: `/tmp/life1540-after-home-${locale}-${width}.png`,
                fullPage: width === 390,
              });
              expect(writes).toEqual([]);
            } finally {
              page.off("request", request);
            }
          }),
        ),
      ),
    );
  });
  test(`demo links: ordinary filters over fixed facts ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
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
            await gotoAndWaitForReady(page, "/catalog/links");
            await expect(forms(page)).toHaveCount(65);
            const search = page
              .getByRole("searchbox")
              .filter({ visible: true });
            await expect(search).toHaveCount(1);
            await search.fill(english ? "Library" : "tushuguan");
            await page
              .locator("#links-filters")
              .getByRole("button", {
                name: english ? "Apply filters" : "应用筛选",
                exact: true,
              })
              .click();
            await expect(forms(page)).toHaveCount(2);
            await expect(pin(page, "library")).toHaveCount(1);
            await expect(pin(page, "study-space-booking")).toHaveCount(1);
            await search.fill("impossible-website-1540");
            await page
              .locator("#links-filters")
              .getByRole("button", {
                name: english ? "Apply filters" : "应用筛选",
                exact: true,
              })
              .click();
            await expect(forms(page)).toHaveCount(0);
            await expect(page.locator("#main-content")).toContainText(
              english
                ? "No websites match this search."
                : "没有匹配当前搜索的网站。",
            );
            await search.fill("");
            await page
              .getByRole("button", {
                name: english ? "Pinned" : "已固定",
                exact: true,
              })
              .click();
            const pinned = page.getByRole("dialog", {
              name: english ? "Pinned" : "已固定",
              exact: true,
            });
            await pinned.locator('[id$="isPinned-true"]').click();
            await page.keyboard.press("Escape");
            await page
              .locator("#links-filters")
              .getByRole("button", {
                name: english ? "Apply filters" : "应用筛选",
                exact: true,
              })
              .click();
            await expect(forms(page)).toHaveCount(2);
            await expect(pin(page, "jw")).toHaveCount(1);
            await expect(pin(page, "library")).toHaveCount(1);
            await page
              .getByRole("button", {
                name: english ? "Visits" : "访问次数",
                exact: true,
              })
              .click();
            const visits = page.getByRole("dialog", {
              name: english ? "Visits" : "访问次数",
              exact: true,
            });
            await visits.locator('input[type="number"]').fill("7");
            await page.keyboard.press("Escape");
            await page
              .locator("#links-filters")
              .getByRole("button", {
                name: english ? "Apply filters" : "应用筛选",
                exact: true,
              })
              .click();
            await expect(forms(page)).toHaveCount(1);
            await expect(pin(page, "library")).toHaveCount(1);
          }),
        ),
      ),
    );
  });
}

test("demo links: same-document identity switch retires real private preferences", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          const actor = await isolatedWorker.createActor();
          const db = isolatedWorker.database.owner;
          await db.workspaceLinkPin.create({
            data: { userId: actor.id, slug: "mail" },
          });
          await db.catalogLinkClick.create({
            data: { userId: actor.id, slug: "library", count: 987654 },
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
              new Error("Website control closed before preference capture"),
            );
          };
          const pattern = "**/_internal/catalog/links/viewer";
          const handler = (route: Route) => {
            const operation = (async () => {
              const response = await route.fetch({ maxRedirects: 0 });
              expect(response.status()).toBe(200);
              const body: unknown = await response.json();
              if (
                !isRecord(body) ||
                !Array.isArray(body.links) ||
                !body.links.every(isRecord)
              )
                throw new Error(
                  "Expected a real link preferences object with link records",
                );
              expect(body.signedIn).toBe(true);
              expect(body.links).toHaveLength(65);
              expect(
                body.links.find((link) => link.slug === "library"),
              ).toMatchObject({ isPinned: false, clickCount: 987654 });
              expect(
                body.links.find((link) => link.slug === "mail"),
              ).toMatchObject({ isPinned: true });
              if (held) throw new Error("Duplicate private preference capture");
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
          try {
            page.on("close", closing);
            page.on("requestfinished", finished);
            page.on("requestfailed", failed);
            await page.route(pattern, handler);
            await page.goto("/catalog/links", {
              waitUntil: "domcontentloaded",
            });
            await expect(page.locator("html")).toHaveAttribute(
              "data-life-ustc-hydrated",
              "true",
            );
            await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
            await captured.promise;
            await page.evaluate(() =>
              Object.assign(window, {
                demoLinksOwner: {
                  heading: document.querySelector("#main-content h1"),
                },
              }),
            );
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
            const current = page.locator(
              '[data-shell-navigation="desktop"] a[data-sidebar="menu-button"][href="/catalog/links"]',
            );
            await expect(current).toHaveCount(1);
            await current.click();
            await expect(
              page.getByTestId("demo-links-fictional"),
            ).toBeVisible();
            await expect(pin(page, "library")).toHaveAccessibleName("Unpin");
            await expect(pin(page, "library")).toBeDisabled();
            expect(
              await page.evaluate(() => {
                const state = window as typeof window & {
                  demoLinksOwner?: { heading: Element | null };
                };
                return Boolean(
                  state.demoLinksOwner &&
                    state.demoLinksOwner.heading ===
                      document.querySelector("#main-content h1"),
                );
              }),
            ).toBe(true);
            await page.evaluate(() => {
              const state = {
                leak: false,
                observer: null as MutationObserver | null,
              };
              state.observer = new MutationObserver((records) => {
                const form = [
                  ...document.querySelectorAll(
                    'form[action="/api/workspace/link-pins"]',
                  ),
                ].find((form) =>
                  form.querySelector('input[name="slug"][value="library"]'),
                );
                if (
                  form?.querySelector("button")?.getAttribute("aria-label") ===
                    "Pin" ||
                  document
                    .querySelector("#main-content")
                    ?.textContent?.includes("987654")
                )
                  state.leak = true;
                for (const record of records)
                  if (
                    record.attributeName === "aria-label" &&
                    record.oldValue === "Pin" &&
                    (record.target as Element)
                      .closest("form")
                      ?.querySelector('input[name="slug"][value="library"]')
                  )
                    state.leak = true;
              });
              state.observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeOldValue: true,
                attributeFilter: ["aria-label"],
              });
              Object.assign(window, { demoLinksLate: state });
            });
            release.resolve();
            await Promise.all(operations);
            await expect.poll(() => terminal).toMatch(/finished|failed/);
            if (terminal === "failed")
              expect(held?.failure()?.errorText).toBe("net::ERR_ABORTED");
            await expect(pin(page, "library")).toHaveAccessibleName("Unpin");
            await expect(pin(page, "library")).toBeDisabled();
            await expect(pin(page, "mail")).toHaveAccessibleName("Pin");
            await expect(
              pin(page, "library").locator("xpath=ancestor::tr[1]"),
            ).toContainText("Visits: 7");
            await expect(page.locator("#main-content")).not.toContainText(
              "987654",
            );
            expect(
              await page.evaluate(() => {
                const state = window as typeof window & {
                  demoLinksLate: { leak: boolean; observer: MutationObserver };
                };
                state.demoLinksLate.observer.disconnect();
                return state.demoLinksLate.leak;
              }),
            ).toBe(false);
          } catch (error) {
            if (!errors.includes(error)) errors.push(error);
          } finally {
            release.resolve();
            captured.reject(new Error("Website identity control ended"));
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
            throw new AggregateError(errors, "Held website preferences failed");
        }),
      ),
    ),
  );
});

for (const transition of [
  "same-page locale",
  "native locale and re-entry",
] as const) {
  test(`demo links: ${transition} preserves fixed personal facts`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            await page.setViewportSize({ width: 1280, height: 844 });
            const demo = await createSignedDemoCookie({
              issuedAt: Math.floor(Date.now() / 1000) - 120,
            });
            await page.context().addCookies([
              { ...demo, url: isolatedWorker.origin },
              {
                name: "NEXT_LOCALE",
                value: "en-us",
                url: isolatedWorker.origin,
              },
            ]);
            await gotoAndWaitForReady(page, "/catalog/links");
            await page.evaluate(() =>
              Object.assign(window, {
                demoLinksDocument: {
                  heading: document.querySelector("#main-content h1"),
                },
              }),
            );
            if (transition === "same-page locale") {
              await page.context().addCookies([
                {
                  name: "NEXT_LOCALE",
                  value: "zh-cn",
                  url: isolatedWorker.origin,
                },
              ]);
              const current = page.locator(
                '[data-shell-navigation="desktop"] a[data-sidebar="menu-button"][href="/catalog/links"]',
              );
              await expect(current).toHaveCount(1);
              await current.click();
              expect(
                await page.evaluate(() => {
                  const state = window as typeof window & {
                    demoLinksDocument?: { heading: Element | null };
                  };
                  return Boolean(
                    state.demoLinksDocument &&
                      state.demoLinksDocument.heading ===
                        document.querySelector("#main-content h1"),
                  );
                }),
              ).toBe(true);
            } else {
              await page
                .getByRole("button", { name: "Language selector", exact: true })
                .click();
              const [response] = await Promise.all([
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
              expect(response.status()).toBe(200);
              await expect(page.locator("html")).toHaveAttribute(
                "lang",
                "zh-cn",
              );
              expect(
                await page.evaluate(() => "demoLinksDocument" in window),
              ).toBe(false);
              await waitForUiSettled(page);
            }
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "网站",
            );
            await expect(pin(page, "library")).toHaveAccessibleName("取消置顶");
            await expect(pin(page, "library")).toBeDisabled();
            await expect(
              pin(page, "library").locator("xpath=ancestor::tr[1]"),
            ).toContainText("访问次数: 7");
            await expect(
              page.getByTestId("demo-links-fictional"),
            ).toContainText("虚构样例");
            if (transition === "native locale and re-entry") {
              await page.evaluate(() =>
                Object.assign(window, { demoLinksExitDocument: true }),
              );
              await page
                .getByRole("button", { name: "退出演示", exact: true })
                .click();
              await expect(page).toHaveURL(/\/account\/sign-in$/);
              expect(
                await page.evaluate(() => "demoLinksExitDocument" in window),
              ).toBe(false);
              await waitForUiSettled(page);
              await expect(page.getByTestId("demo-notice")).toHaveCount(0);
              await page
                .getByRole("button", { name: "进入演示", exact: true })
                .click();
              await expect(page).toHaveURL(/\/workspace\/todos$/);
              await gotoAndWaitForReady(page, "/catalog/links");
              await expect(forms(page)).toHaveCount(65);
              await expect(pin(page, "jw")).toHaveAccessibleName("取消置顶");
              await expect(pin(page, "jw")).toBeDisabled();
              await expect(
                pin(page, "jw").locator("xpath=ancestor::tr[1]"),
              ).toContainText("访问次数: 12");
            }
          }),
        ),
      ),
    );
  });
}
