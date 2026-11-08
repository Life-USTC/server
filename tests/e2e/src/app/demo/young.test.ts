import { expect, type Page, type Request, type Route } from "@playwright/test";
import { unflatten } from "devalue";
import en from "../../../../../messages/en-us.json" with { type: "json" };
import zh from "../../../../../messages/zh-cn.json" with { type: "json" };
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
import {
  applyYoungTableFilters,
  openYoungTableField,
  setYoungTableChoices,
} from "../../../utils/young-table-filters";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const base = "/catalog/young-events";
const events = (page: Page) =>
  page.locator(
    '#main-content a[href^="/catalog/young-events/demo-young-"]:visible',
  );
const organizers = (page: Page) =>
  page.locator(
    '#main-content a[href^="/catalog/young-events/organizers/demo-young-organizer-"]:visible',
  );
const scenes = [
  ["list", base],
  ["detail", `${base}/demo-young-1`],
  ["calendar", `${base}/calendar`],
  ["organizers", `${base}/organizers`],
  ["organizer-detail", `${base}/organizers/demo-young-organizer-1`],
] as const;
async function atNaturalTop(page: Page) {
  await page.locator("#main-content").focus();
  await page.keyboard.press("Control+Home");
  await expect
    .poll(() =>
      page.evaluate(() => ({
        document: document.scrollingElement?.scrollTop ?? 0,
        regions: [
          ...document.querySelectorAll("[data-shell-scroll-container]"),
        ].map((element) => element.scrollTop),
      })),
    )
    .toEqual({ document: 0, regions: [0] });
}
async function fixedSubscription(
  page: Page,
  checked: boolean,
  locale: "en-us" | "zh-cn",
  kind: "events" | "organizers" = "events",
) {
  const c = (locale === "en-us" ? en : zh).youngEvents.workspace;
  const facts = page.getByTestId("demo-young-subscription-facts");
  await expect(facts).toContainText(
    locale === "en-us"
      ? "Fixed fictional subscription facts"
      : "固定虚构订阅事实",
  );
  const flag = facts.getByRole("checkbox");
  await expect(flag).toBeDisabled();
  if (checked) await expect(flag).toBeChecked();
  else await expect(flag).not.toBeChecked();
  await expect(
    page.getByRole("button", {
      name:
        kind === "events"
          ? checked
            ? c.unsubscribe
            : c.subscribe
          : checked
            ? c.unfollow
            : c.follow,
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: c.signin, exact: true }),
  ).toHaveCount(0);
}
for (const [family, path] of scenes)
  for (const [locale, width] of [
    ["en-us", 1280],
    ["zh-cn", 390],
  ] as const) {
    test(`demo Young: existing ${family} ${locale} ${width}`, {
      tag: "@Account/Web",
    }, async ({ page, isolatedWorker, run }) => {
      await withBrowserWorkflow(page, (workflow) =>
        workflow.run(() =>
          run(() =>
            workflow.body(async () => {
              const c = locale === "en-us" ? en : zh,
                english = locale === "en-us";
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
              const writes: string[] = [],
                personalReads: string[] = [];
              const observe = (request: Request) => {
                const path = new URL(request.url()).pathname;
                if (!["GET", "HEAD"].includes(request.method()))
                  writes.push(`${request.method()} ${path}`);
                if (
                  path === "/api/workspace/calendar/events" ||
                  path.startsWith("/api/workspace/young-")
                )
                  personalReads.push(path);
              };
              page.on("request", observe);
              try {
                await gotoAndWaitForReady(page, path);
                await expect(page.getByTestId("demo-notice")).toBeVisible();
                await expect(
                  page.getByTestId("demo-young-fictional"),
                ).toContainText(
                  english ? "fixed fictional samples" : "固定虚构样例",
                );
                await expect(
                  page.getByTestId("young-source-freshness"),
                ).toContainText(c.youngEvents.sourceUnknown);
                if (family === "list")
                  await expect(events(page)).toHaveCount(20);
                else if (family === "organizers")
                  await expect(organizers(page)).toHaveCount(20);
                else if (family === "organizer-detail") {
                  await expect(events(page)).toHaveCount(20);
                  await fixedSubscription(page, true, locale, "organizers");
                  const manage = page
                    .locator("#main-content aside")
                    .getByRole("button", {
                      name: c.youngEvents.workspace.manage,
                      exact: true,
                    });
                  await expect(manage).toHaveCount(1);
                  await expect(manage).toBeDisabled();
                  await expect(manage).not.toHaveAttribute("href");
                } else if (family === "detail") {
                  await expect(
                    page.getByRole("heading", { level: 1 }),
                  ).toHaveText(
                    english ? "Fictional algebra discussion" : "虚构代数讨论",
                  );
                  await fixedSubscription(page, true, locale);
                  await expect(
                    page.getByTestId("young-event-signup"),
                  ).toBeDisabled();
                  await expect(
                    page.getByTestId("young-event-signup"),
                  ).not.toHaveAttribute("href");
                  await expect(
                    page.locator('a[href^="https://young.ustc.edu.cn"]'),
                  ).toHaveCount(0);
                  const poster = page
                    .getByTestId("young-event-poster")
                    .getByRole("img");
                  await expect
                    .poll(() =>
                      poster.evaluate((element) => ({
                        complete: (element as HTMLImageElement).complete,
                        width: (element as HTMLImageElement).naturalWidth,
                        height: (element as HTMLImageElement).naturalHeight,
                      })),
                    )
                    .toEqual({ complete: true, width: 320, height: 120 });
                  await expect(
                    page.locator(
                      '#comments article[id^="comment-demo-comment-young-"]:not([id*="-reply-"])',
                    ),
                  ).toHaveCount(20);
                  await expect(
                    page.locator("#comments").getByRole("textbox"),
                  ).toHaveCount(0);
                  await expect(
                    page.locator("#comments").getByRole("button", {
                      name: english ? "Post comment" : "发布评论",
                      exact: true,
                    }),
                  ).toBeDisabled();
                } else {
                  const calendar = page.getByTestId(
                    width === 1280
                      ? "young-calendar-grid"
                      : "young-calendar-agenda",
                  );
                  const conflict = calendar.locator(
                    'a[href="/catalog/young-events/demo-young-1"]',
                  );
                  await expect(conflict).toHaveCount(1);
                  if (width === 1280) {
                    await expect(conflict).toHaveAttribute(
                      "title",
                      new RegExp(c.youngEvents.workspace.conflict),
                    );
                    await expect(calendar.getByRole("gridcell")).toHaveCount(
                      35,
                    );
                    await expect(
                      calendar
                        .getByRole("gridcell")
                        .first()
                        .locator("a")
                        .first(),
                    ).toHaveAttribute(
                      "href",
                      `${base}/calendar?view=day&date=2026-08-30`,
                    );
                    await expect(
                      calendar
                        .getByRole("gridcell")
                        .last()
                        .locator("a")
                        .first(),
                    ).toHaveAttribute(
                      "href",
                      `${base}/calendar?view=day&date=2026-10-03`,
                    );
                  } else
                    await expect(conflict).toContainText(
                      c.youngEvents.workspace.conflict,
                    );
                  await expect(
                    page.getByTestId("young-calendar-conflict-status"),
                  ).toContainText(c.youngEvents.conflictScope);
                }
                await expectRenderedUiQuality(page);
                await expectNoPageHorizontalOverflow(page);
                await atNaturalTop(page);
                const screenshot = `/tmp/life1536-after-${family}-${locale}-${width}.png`;
                const calendarFrame =
                  family === "calendar" && locale === "en-us" && width === 1280;
                await page.screenshot({
                  path: calendarFrame
                    ? screenshot.replace(".png", "-calendar-top.png")
                    : screenshot,
                  fullPage: true,
                });
                if (calendarFrame) {
                  await page
                    .getByTestId("young-calendar-grid")
                    .scrollIntoViewIfNeeded();
                  await page.screenshot({ path: screenshot, fullPage: false });
                }
                if (family === "list") {
                  await events(page).nth(19).scrollIntoViewIfNeeded();
                  await expect(events(page)).toHaveCount(40);
                  await events(page).nth(39).scrollIntoViewIfNeeded();
                  await expect(events(page)).toHaveCount(42);
                  expect(
                    new Set(
                      await events(page).evaluateAll((nodes) =>
                        nodes.map(
                          (node) => (node as HTMLAnchorElement).pathname,
                        ),
                      ),
                    ).size,
                  ).toBe(42);
                  await gotoAndWaitForReady(page, base);
                  await setYoungTableChoices(page, "category", [
                    "单次项目",
                    "系列项目",
                  ]);
                  await applyYoungTableFilters(page);
                  await waitForUiSettled(page);
                  await expect(events(page)).toHaveCount(20);
                  const capacity = await openYoungTableField(page, "capacity");
                  await capacity
                    .locator('input[type="number"]')
                    .first()
                    .fill("20");
                  await applyYoungTableFilters(page);
                  await waitForUiSettled(page);
                  await expect(events(page)).toHaveCount(1);
                  await expect(events(page)).toHaveAttribute(
                    "href",
                    `${base}/demo-young-1`,
                  );
                  await gotoAndWaitForReady(
                    page,
                    `${base}?dateUnknown=true&timeBasis=registration`,
                  );
                  await expect(events(page)).toHaveCount(2);
                  expect(
                    (
                      await events(page).evaluateAll((nodes) =>
                        nodes.map(
                          (node) => (node as HTMLAnchorElement).pathname,
                        ),
                      )
                    ).sort(),
                  ).toEqual([`${base}/demo-young-13`, `${base}/demo-young-8`]);
                } else if (family === "organizers") {
                  await organizers(page).nth(19).scrollIntoViewIfNeeded();
                  await expect(organizers(page)).toHaveCount(22);
                  await page
                    .locator(
                      `#main-content a[href="${base}/organizers/demo-young-organizer-22"]:visible`,
                    )
                    .click();
                  await waitForUiSettled(page);
                  await expect(events(page)).toHaveCount(0);
                  await fixedSubscription(page, false, locale, "organizers");
                } else if (family === "organizer-detail") {
                  await events(page).nth(19).scrollIntoViewIfNeeded();
                  await expect(events(page)).toHaveCount(22);
                  expect(
                    new Set(
                      await events(page).evaluateAll((nodes) =>
                        nodes.map(
                          (node) => (node as HTMLAnchorElement).pathname,
                        ),
                      ),
                    ).size,
                  ).toBe(22);
                } else if (family === "detail") {
                  const comments = page.locator("#comments"),
                    roots = comments.locator(
                      'article[id^="comment-demo-comment-young-"]:not([id*="-reply-"])',
                    );
                  await comments
                    .getByRole("button", {
                      name: `${c.comments.tabYoungEvent}: ${c.comments.loadMoreComments}`,
                      exact: true,
                    })
                    .click();
                  await expect(roots).toHaveCount(21);
                  await comments
                    .getByRole("button", {
                      name: c.comments.loadMoreReplies,
                      exact: true,
                    })
                    .click();
                  await expect(
                    page.locator("#comment-demo-comment-young-reply-11"),
                  ).toBeVisible();
                  await gotoAndWaitForReady(
                    page,
                    "/community/comments/demo-comment-young-reply-11",
                  );
                  await expect(page).toHaveURL(
                    new RegExp(
                      `${base}/demo-young-1#comment-demo-comment-young-reply-11$`,
                    ),
                  );
                  await expect(
                    page.locator("#comment-demo-comment-young-reply-11"),
                  ).toBeVisible();
                  await gotoAndWaitForReady(page, `${base}/demo-young-2`);
                  await fixedSubscription(page, false, locale);
                  await expect(
                    page.locator("#comment-demo-comment-young-second"),
                  ).toBeVisible();
                  await expect(
                    page.locator("#comment-demo-comment-young-01"),
                  ).toHaveCount(0);
                  await gotoAndWaitForReady(page, `${base}/demo-young-13`);
                  await expect(page.locator("#main-content")).toContainText(
                    c.youngEvents.signupNotRequired,
                  );
                } else {
                  await page
                    .locator(
                      `#main-content a[href="${base}/calendar?view=week&date=2026-09-24"]`,
                    )
                    .click();
                  await waitForUiSettled(page);
                  await expect(page).toHaveURL(/view=week&date=2026-09-24$/);
                  if (width === 1280)
                    await expect(
                      page
                        .getByTestId("young-calendar-grid")
                        .getByRole("gridcell"),
                    ).toHaveCount(7);
                  await page
                    .locator(
                      `#main-content a[href="${base}/calendar?view=day&date=2026-09-24"]`,
                    )
                    .first()
                    .click();
                  await waitForUiSettled(page);
                  await expect(page).toHaveURL(/view=day&date=2026-09-24$/);
                  await gotoAndWaitForReady(
                    page,
                    `${base}/calendar?view=week&date=2026-09-27`,
                  );
                  await page
                    .getByTestId("young-calendar")
                    .getByRole("link", {
                      name: c.youngEvents.today,
                      exact: true,
                    })
                    .click();
                  await waitForUiSettled(page);
                  await expect(page).toHaveURL(/view=week&date=2026-09-24$/);
                  await gotoAndWaitForReady(
                    page,
                    `${base}/calendar?timeBasis=registration`,
                  );
                  await expect(
                    page.getByTestId("young-calendar-unknown-dates"),
                  ).toContainText(`2 ${c.youngEvents.unknownDates}`);
                  await expect(
                    page.getByTestId("young-calendar-conflict-status"),
                  ).toHaveCount(0);
                }
                expect(writes).toEqual([]);
                expect(personalReads).toEqual([]);
              } finally {
                page.off("request", observe);
              }
            }),
          ),
        ),
      );
    });
  }

for (const transition of [
  "ordinary-to-demo",
  "same-page locale",
  "locale reload",
  "exit and re-entry",
] as const) {
  test(`demo Young: ${transition} retires a real held event page`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            await page.setViewportSize({ width: 1280, height: 844 });
            const ordinary = transition === "ordinary-to-demo";
            const actor = ordinary ? await isolatedWorker.createActor() : null;
            if (ordinary)
              await isolatedWorker.database.owner.youngEvent.createMany({
                data: Array.from({ length: 22 }, (_, index) => ({
                  youngId: `ordinary-young-${crypto.randomUUID()}`,
                  name: `Owned ordinary activity ${index + 1}`,
                  isActive: true,
                  rawJson: {},
                })),
              });
            await page.context().addCookies([
              actor?.cookie ?? {
                ...(await createSignedDemoCookie({
                  issuedAt: Math.floor(Date.now() / 1000) - 120,
                })),
                url: isolatedWorker.origin,
              },
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
              terminal: "finished" | "failed" | undefined,
              fulfilled = false;
            const finished = (request: Request) => {
                if (request === held) terminal = "finished";
              },
              failed = (request: Request) => {
                if (request === held) terminal = "failed";
              };
            const closing = () => {
              release.resolve();
              captured.reject(
                new Error("Young public owner closed before capture"),
              );
            };
            const pattern = "**/catalog/young-events/__data.json?**";
            const handler = (route: Route) => {
              if (
                new URL(route.request().url()).searchParams.get("page") !== "2"
              )
                return route.continue();
              const operation = (async () => {
                const response = await route.fetch({ maxRedirects: 0 });
                expect(response.status()).toBe(200);
                const envelope = await response.json();
                const data = unflatten(envelope.nodes.at(-1).data) as {
                  data: { youngId: string; name: string }[];
                  pagination: { page: number; pageSize: number; total: number };
                };
                expect(data.pagination).toMatchObject({
                  page: 2,
                  pageSize: 20,
                });
                const oldOrdinary = data.data.every((event) =>
                  event.name.startsWith("Owned ordinary activity"),
                );
                const english = data.data.every((event) =>
                  event.name.startsWith("Fictional"),
                );
                if (oldOrdinary) {
                  expect(data.pagination.total).toBe(22);
                  expect(data.data).toHaveLength(2);
                } else {
                  expect(data.pagination.total).toBe(42);
                  expect(data.data).toHaveLength(20);
                  for (const event of data.data)
                    expect(event.youngId).toMatch(
                      /^demo-young-(?:[1-9]|[1-3]\d|4[0-2])$/,
                    );
                }
                const old = ordinary ? oldOrdinary : english;
                if (old) {
                  if (held) throw new Error("Duplicate held Young page");
                  held = route.request();
                  captured.resolve();
                  await release.promise;
                } else if (ordinary) expect(english).toBe(true);
                else
                  expect(
                    data.data.every((event) => event.name.startsWith("虚构")),
                  ).toBe(true);
                await route.fulfill({ response }).catch((error: unknown) => {
                  if (
                    route.request().failure()?.errorText !== "net::ERR_ABORTED"
                  )
                    throw error;
                });
                if (old) fulfilled = true;
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
              await gotoAndWaitForReady(page, base);
              const initialEvents = ordinary
                ? page.locator(
                    '#main-content a[href^="/catalog/young-events/ordinary-young-"]:visible',
                  )
                : events(page);
              await expect(initialEvents).toHaveCount(20);
              if (ordinary)
                for (const link of await initialEvents.all())
                  await expect(link).toContainText("Owned ordinary activity");
              await initialEvents.nth(19).scrollIntoViewIfNeeded();
              await captured.promise;
              await page.evaluate(() =>
                Object.assign(window, {
                  demoYoungPublicDocument: {
                    heading: document.querySelector("#main-content h1"),
                  },
                }),
              );
              if (transition === "exit and re-entry") {
                await page
                  .getByRole("button", { name: "Exit demo", exact: true })
                  .click();
                await expect(page).toHaveURL(/\/account\/sign-in$/);
                expect(
                  await page.evaluate(
                    () => "demoYoungPublicDocument" in window,
                  ),
                ).toBe(false);
                await waitForUiSettled(page);
              }
              if (ordinary) {
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
                  .locator(
                    '[data-shell-navigation="desktop"] a[data-slot="sidebar-menu-button"][href="/catalog/young-events"]',
                  )
                  .click();
              } else if (transition === "same-page locale") {
                await page.context().addCookies([
                  {
                    name: "NEXT_LOCALE",
                    value: "zh-cn",
                    url: isolatedWorker.origin,
                  },
                ]);
                await page
                  .locator(
                    '[data-shell-navigation="desktop"] a[data-slot="sidebar-menu-button"][href="/catalog/young-events"]',
                  )
                  .click();
              } else {
                await page
                  .getByRole("button", {
                    name: "Language selector",
                    exact: true,
                  })
                  .click();
                const [preference] = await Promise.all([
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
                expect(preference.status()).toBe(200);
                expect(preference.request().postDataJSON()).toEqual({
                  locale: "zh-cn",
                });
                await expect(page.locator("html")).toHaveAttribute(
                  "lang",
                  "zh-cn",
                );
              }
              if (transition === "exit and re-entry") {
                await page
                  .getByRole("button", { name: "进入演示", exact: true })
                  .click();
                await expect(page).toHaveURL(/\/workspace\/todos$/);
                await gotoAndWaitForReady(page, base);
              }
              await expect(
                page.getByTestId("demo-young-fictional"),
              ).toBeVisible();
              await expect(events(page)).toHaveCount(20);
              await expect(events(page).first()).toContainText(
                ordinary ? "Fictional" : "虚构",
              );
              if (ordinary || transition === "same-page locale")
                expect(
                  await page.evaluate(() => {
                    const state = window as typeof window & {
                      demoYoungPublicDocument?: { heading: Element | null };
                    };
                    return Boolean(
                      state.demoYoungPublicDocument &&
                        state.demoYoungPublicDocument.heading ===
                          document.querySelector("#main-content h1"),
                    );
                  }),
                ).toBe(true);
              else
                expect(
                  await page.evaluate(
                    () => "demoYoungPublicDocument" in window,
                  ),
                ).toBe(false);
              await page.evaluate((ordinary) => {
                const content = document.querySelector("#main-content");
                if (!content) throw new Error("Missing current Young content");
                const state = {
                  leak: false,
                  observer: null as MutationObserver | null,
                };
                state.observer = new MutationObserver(() => {
                  if (
                    (ordinary ? /Owned ordinary activity/ : /Fictional/).test(
                      content.textContent ?? "",
                    )
                  )
                    state.leak = true;
                });
                state.observer.observe(content, {
                  childList: true,
                  subtree: true,
                  characterData: true,
                });
                Object.assign(window, { demoYoungPublicOwner: state });
              }, ordinary);
              release.resolve();
              await Promise.all(operations);
              expect(fulfilled).toBe(true);
              if (ordinary || transition === "same-page locale") {
                await expect.poll(() => terminal).toMatch(/finished|failed/);
                if (terminal === "failed")
                  expect(held?.failure()?.errorText).toBe("net::ERR_ABORTED");
              }
              // Native locale reload and exit retire the document; the actual callback above is still joined.
              await events(page).nth(19).scrollIntoViewIfNeeded();
              await expect(events(page)).toHaveCount(40);
              await events(page).nth(39).scrollIntoViewIfNeeded();
              await expect(events(page)).toHaveCount(42);
              expect(
                new Set(
                  await events(page).evaluateAll((nodes) =>
                    nodes.map((node) => (node as HTMLAnchorElement).pathname),
                  ),
                ).size,
              ).toBe(42);
              await expect(page.locator("#main-content")).not.toContainText(
                ordinary ? "Owned ordinary activity" : "Fictional",
              );
              expect(
                await page.evaluate(() => {
                  const state = window as typeof window & {
                    demoYoungPublicOwner: {
                      leak: boolean;
                      observer: MutationObserver;
                    };
                  };
                  state.demoYoungPublicOwner.observer.disconnect();
                  return state.demoYoungPublicOwner.leak;
                }),
              ).toBe(false);
            } catch (error) {
              if (!errors.includes(error)) errors.push(error);
            } finally {
              release.resolve();
              captured.reject(new Error("Young public owner ended"));
              try {
                await page.unroute(pattern, handler);
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
                "Young public owner workflow failed",
              );
          }),
        ),
      ),
    );
  });
}

test("demo Young: a retired ordinary detail cannot apply a late false subscription to the current true sample", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          const actor = await isolatedWorker.createActor();
          await isolatedWorker.database.owner.youngEvent.create({
            data: {
              youngId: "demo-young-1",
              name: "Owned ordinary detail with no subscription",
              isActive: true,
              requiresSignup: true,
              rawJson: {},
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
          const captured = createDeferred(),
            release = createDeferred();
          void captured.promise.catch(() => undefined);
          const operations: Promise<void>[] = [],
            errors: unknown[] = [];
          let held: Request | undefined,
            terminal: "finished" | "failed" | undefined,
            callbackCompleted = false;
          const finished = (request: Request) => {
              if (request === held) terminal = "finished";
            },
            failed = (request: Request) => {
              if (request === held) terminal = "failed";
            };
          const closing = () => {
            release.resolve();
            captured.reject(
              new Error("Young subscription owner closed before capture"),
            );
          };
          const pattern =
            "**/api/workspace/young-event-subscriptions/demo-young-1";
          const handler = (route: Route) => {
            const operation = (async () => {
              if (held)
                throw new Error("Duplicate held ordinary subscription read");
              const response = await route.fetch({ maxRedirects: 0 });
              expect(response.status()).toBe(200);
              expect(await response.json()).toMatchObject({
                subscribed: false,
              });
              held = route.request();
              captured.resolve();
              await release.promise;
              await route.fulfill({ response }).catch((error: unknown) => {
                if (route.request().failure()?.errorText !== "net::ERR_ABORTED")
                  throw error;
              });
              callbackCompleted = true;
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
            await page.goto(`${base}/demo-young-1`, {
              waitUntil: "domcontentloaded",
            });
            await page.waitForFunction(
              () =>
                document.documentElement.dataset.lifeUstcHydrated === "true",
            );
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "Owned ordinary detail with no subscription",
            );
            await captured.promise;
            await page.evaluate(() =>
              Object.assign(window, {
                demoYoungPrivateDocument: {
                  heading: document.querySelector("#main-content h1"),
                  currentHeading: null as Element | null,
                  leak: false,
                  observer: null as MutationObserver | null,
                },
              }),
            );
            const collection = page.locator(
              '[data-shell-navigation="desktop"] a[data-slot="sidebar-menu-button"][href="/catalog/young-events"]',
            );
            await expect(collection).toHaveCount(1);
            await collection.click();
            await waitForUiSettled(page);
            await expect(events(page)).toHaveCount(1);
            await expect(events(page)).toHaveText(
              "Owned ordinary detail with no subscription",
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
            await page
              .locator(
                '#main-content a[href="/catalog/young-events/demo-young-1"]:visible',
              )
              .click();
            await waitForUiSettled(page);
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "Fictional algebra discussion",
            );
            await fixedSubscription(page, true, "en-us");
            expect(
              await page.evaluate(() => {
                const state = window as typeof window & {
                  demoYoungPrivateDocument?: { heading: Element | null };
                };
                return Boolean(
                  state.demoYoungPrivateDocument &&
                    state.demoYoungPrivateDocument.heading !==
                      document.querySelector("#main-content h1"),
                );
              }),
            ).toBe(true);
            await page.evaluate(() => {
              const state = window as typeof window & {
                demoYoungPrivateDocument: {
                  currentHeading: Element | null;
                  leak: boolean;
                  observer: MutationObserver | null;
                };
              };
              state.demoYoungPrivateDocument.currentHeading =
                document.querySelector("#main-content h1");
              const facts = document.querySelector(
                '[data-testid="demo-young-subscription-facts"]',
              );
              if (!facts)
                throw new Error("Missing current fixed subscription facts");
              state.demoYoungPrivateDocument.observer = new MutationObserver(
                (records) => {
                  if (
                    records.some(
                      (record) =>
                        record.type === "attributes" &&
                        record.attributeName === "aria-checked" &&
                        record.oldValue === "false",
                    ) ||
                    facts
                      .querySelector('[role="checkbox"]')
                      ?.getAttribute("aria-checked") !== "true" ||
                    document
                      .querySelector("#main-content")
                      ?.textContent?.includes("Owned ordinary detail")
                  )
                    state.demoYoungPrivateDocument.leak = true;
                },
              );
              state.demoYoungPrivateDocument.observer.observe(facts, {
                subtree: true,
                childList: true,
                characterData: true,
                attributes: true,
                attributeOldValue: true,
                attributeFilter: ["aria-checked"],
              });
            });
            release.resolve();
            await Promise.all(operations);
            expect(callbackCompleted).toBe(true);
            await expect.poll(() => terminal).toMatch(/finished|failed/);
            if (terminal === "failed")
              expect(held?.failure()?.errorText).toBe("net::ERR_ABORTED");
            await fixedSubscription(page, true, "en-us");
            await expect(page.locator("#main-content")).not.toContainText(
              "Owned ordinary detail",
            );
            expect(
              await page.evaluate(() => {
                const state = window as typeof window & {
                  demoYoungPrivateDocument: {
                    currentHeading: Element | null;
                    leak: boolean;
                    observer: MutationObserver | null;
                  };
                };
                state.demoYoungPrivateDocument.observer?.disconnect();
                return {
                  leak: state.demoYoungPrivateDocument.leak,
                  sameCurrentDetail:
                    state.demoYoungPrivateDocument.currentHeading ===
                    document.querySelector("#main-content h1"),
                };
              }),
            ).toEqual({ leak: false, sameCurrentDetail: true });
          } catch (error) {
            if (!errors.includes(error)) errors.push(error);
          } finally {
            release.resolve();
            captured.reject(new Error("Young subscription owner ended"));
            try {
              await page.unroute(pattern, handler);
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
              "Young subscription owner workflow failed",
            );
        }),
      ),
    ),
  );
});

for (const [locale, width, current, historical, noSignup] of [
  [
    "en-us",
    1280,
    "Current signup list",
    "Historical activity list",
    "No registration required",
  ],
  ["zh-cn", 390, "当前报名列表", "历史活动列表", "无需报名"],
] as const) {
  test(`young membership: no-signup sample and localized status filters ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
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
            await gotoAndWaitForReady(page, `${base}/demo-young-13`);
            await expect(
              page.locator("#main-content [data-status-token]"),
            ).toHaveText(current);
            await expect(page.locator("#main-content")).toContainText(noSignup);
            await fixedSubscription(page, false, locale);
            await expect(page.getByTestId("young-event-signup")).toBeDisabled();
            await atNaturalTop(page);
            await page.screenshot({
              path: `/tmp/life1538-after-detail-${locale}-${width}.png`,
              fullPage: true,
            });
            await gotoAndWaitForReady(page, base);
            const historicalField = await openYoungTableField(page, "status");
            await historicalField.locator("input").fill(historical);
            await applyYoungTableFilters(page);
            await expect(page).toHaveURL(
              (url) => url.searchParams.get("status") === historical,
            );
            await expect(events(page)).toHaveCount(11);
            expect(
              (
                await events(page).evaluateAll((nodes) =>
                  nodes.map((node) => (node as HTMLAnchorElement).pathname),
                )
              ).sort(),
            ).toEqual(
              [
                `${base}/demo-young-10`,
                ...Array.from(
                  { length: 10 },
                  (_, index) => `${base}/demo-young-${index + 33}`,
                ),
              ].sort(),
            );
            const currentField = await openYoungTableField(page, "status");
            await currentField.locator("input").fill(current);
            await applyYoungTableFilters(page);
            await expect(page).toHaveURL(
              (url) => url.searchParams.get("status") === current,
            );
            await expect(events(page)).toHaveCount(20);
            await events(page).nth(19).scrollIntoViewIfNeeded();
            await expect(events(page)).toHaveCount(31);
            await expect(
              page.locator(
                `#main-content a[href="${base}/demo-young-13"]:visible`,
              ),
            ).toHaveCount(1);
            await expect(
              page.locator(
                `#main-content a[href="${base}/demo-young-10"]:visible`,
              ),
            ).toHaveCount(0);
            await expectNoPageHorizontalOverflow(page);
          }),
        ),
      ),
    );
  });
}
