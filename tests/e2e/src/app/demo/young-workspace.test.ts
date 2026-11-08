import {
  expect,
  type JSHandle,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";
import { unflatten } from "devalue";
import { createDeferred } from "../../../../shared/deferred";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const root = "/workspace/subscriptions/activities";
const row = (page: Page, view: string) =>
  page.getByTestId(
    `young-workspace-${view === "events" ? "event" : view === "organizers" ? "organizer" : "notification"}-row`,
  );
const eventIds = [
  1, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
  9,
].map((n) => `demo-young-${n}`);
const unreadNotificationIds = [
  "demo-young-notification-event_start",
  ...Array.from(
    { length: 17 },
    (_, index) =>
      `demo-young-notification-change-${String(19 - index).padStart(2, "0")}`,
  ),
  "demo-young-notification-signup_open",
  "demo-young-notification-signup_deadline",
  "demo-young-notification-digest",
];
const organizerIds = [
  1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 2, 20, 21, 3, 4, 5, 6, 7, 8, 9,
].map((n) => `demo-young-organizer-${n}`);
async function demo(page: Page, origin: string, locale = "en-us") {
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      ...(await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
      })),
      url: origin,
    },
    { name: "NEXT_LOCALE", value: locale, url: origin },
  ]);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function decoded(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.nodes))
    throw new Error("Missing actual page data");
  const node: unknown = value.nodes.at(-1);
  if (!isRecord(node) || !Array.isArray(node.data))
    throw new Error("Missing flattened page data");
  const data: unknown = unflatten(node.data);
  if (!isRecord(data)) throw new Error("Missing decoded page data");
  return data;
}
async function append(page: Page, view: string, total: number) {
  const rows = row(page, view);
  await expect(rows).toHaveCount(20);
  const endless = page.locator('[data-slot="endless-scroll"]');
  await expect(
    endless.getByRole("link", { name: /Load more|加载更多/ }),
  ).toHaveAttribute(
    "href",
    `${root}?view=${view}${view === "notifications" && new URL(page.url()).searchParams.get("unread") === "true" ? "&unread=true" : ""}&page=2`,
  );
  await endless.scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(total);
  await expect(endless).toHaveCount(0);
}
for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  test(`demo young workspace reads fixed facts ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            await page.setViewportSize({ width, height: 844 });
            await demo(page, isolatedWorker.origin, locale);
            const writes: string[] = [];
            page.on("request", (request) => {
              if (
                ["PUT", "POST", "DELETE"].includes(request.method()) &&
                new URL(request.url()).pathname.startsWith(
                  "/api/workspace/young-",
                )
              )
                writes.push(request.url());
            });
            for (const view of [
              "events",
              "organizers",
              "notifications",
            ] as const) {
              const path = `${root}?view=${view}`;
              const response = await gotoAndWaitForReady(page, path);
              expect(response?.status()).toBe(200);
              await expect(page.getByTestId("demo-notice")).toBeVisible();
              await expect(
                page.getByTestId("demo-young-workspace-fictional"),
              ).toHaveText(
                locale === "en-us"
                  ? "Fixed fictional subscriptions and notifications."
                  : "固定虚构的订阅和通知样例。",
              );
              await expect(page.getByTestId("demo-notice")).toContainText(
                locale === "en-us"
                  ? "Changes and external actions are disabled."
                  : "无法修改数据或执行外部操作。",
              );
              const rows = row(page, view);
              await expect(rows).toHaveCount(20);
              if (view === "events") {
                await expect(rows.first()).toContainText(
                  locale === "en-us"
                    ? "Fictional algebra discussion"
                    : "虚构代数讨论",
                );
                await expect(
                  rows.first().getByRole("checkbox").first(),
                ).toBeChecked();
                await expect(
                  rows.first().getByRole("checkbox").first(),
                ).toBeDisabled();
                await rows
                  .first()
                  .getByRole("button", {
                    name: locale === "en-us" ? "Reminder settings" : "提醒设置",
                    exact: true,
                  })
                  .click();
                const mixedFlags = rows.first().getByRole("checkbox");
                await expect(mixedFlags).toHaveCount(4);
                for (const [index, checked] of [
                  true,
                  true,
                  false,
                  true,
                ].entries()) {
                  await expect(mixedFlags.nth(index)).toBeChecked({ checked });
                  await expect(mixedFlags.nth(index)).toBeDisabled();
                }
                await page.locator("#main-content").focus();
                await page.keyboard.press("Control+Home");
                await expect
                  .poll(() =>
                    page.evaluate(
                      () =>
                        document.scrollingElement !== null &&
                        [
                          document.scrollingElement,
                          ...document.querySelectorAll(
                            "[data-shell-scroll-container]",
                          ),
                        ].every((element) => element.scrollTop === 0),
                    ),
                  )
                  .toBe(true);
                const heading = page.getByRole("heading", { level: 1 });
                await expect(heading).toBeVisible();
                await expect(heading).toBeInViewport({ ratio: 1 });
                await expect
                  .poll(() =>
                    heading.evaluate((element) => {
                      const rect = element.getBoundingClientRect();
                      const hit = document.elementFromPoint(
                        rect.x + rect.width / 2,
                        rect.y + rect.height / 2,
                      );
                      return hit !== null && element.contains(hit);
                    }),
                  )
                  .toBe(true);
                await page.screenshot({
                  path: `/tmp/life1548-after-activities-${locale}-${width}-settled.png`,
                  fullPage: true,
                });
              }
              if (view !== "notifications") {
                const mutations = rows.getByRole("button", {
                  name:
                    locale === "en-us"
                      ? view === "events"
                        ? "Unsubscribe from activity"
                        : "Unfollow"
                      : view === "events"
                        ? "取消订阅活动"
                        : "取消关注",
                  exact: true,
                });
                await expect(mutations).toHaveCount(20);
                for (const button of await mutations.all())
                  await expect(button).toBeDisabled();
              } else {
                const mark = rows.getByRole("button", {
                  name: locale === "en-us" ? "Mark read" : "标记已读",
                  exact: true,
                });
                expect(await mark.count()).toBeGreaterThan(0);
                for (const button of await mark.all())
                  await expect(button).toBeDisabled();
              }
              await append(page, view, view === "notifications" ? 23 : 21);
              if (view !== "notifications")
                expect(
                  await rows.evaluateAll((nodes) =>
                    nodes.map((node) => node.getAttribute("data-record-id")),
                  ),
                ).toEqual(view === "events" ? eventIds : organizerIds);
              else {
                await page
                  .getByRole("radio", {
                    name: locale === "en-us" ? "Unread only" : "仅未读",
                    exact: true,
                  })
                  .click();
                await expect(page).toHaveURL(`${path}&unread=true`);
                await append(page, view, 21);
                await expect(
                  rows.locator('[data-slot="badge"]').filter({
                    hasText: locale === "en-us" ? /^Unread$/ : /^未读$/,
                  }),
                ).toHaveCount(21);
                await page
                  .getByRole("radio", {
                    name: locale === "en-us" ? "All reminders" : "全部提醒",
                    exact: true,
                  })
                  .click();
                await expect(page).toHaveURL(path);
                await expect(rows).toHaveCount(20);
              }
              await expectNoPageHorizontalOverflow(page);
            }
            const bootstrap = await page.request.get(
              "/_internal/shell-bootstrap",
            );
            expect(bootstrap.status()).toBe(200);
            expect(await bootstrap.json()).toMatchObject({
              viewer: null,
              navigation: {
                unreadActivityNotificationsCount: 21,
                calendarItemsCount: 30,
              },
            });
            expect(writes).toEqual([]);
          }),
        ),
      ),
    );
  });
}

for (const mode of ["ordinary", "locale"] as const) {
  test(`demo young workspace retires a real held ${mode} notification page`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            await page.setViewportSize({ width: 1280, height: 844 });
            if (mode === "ordinary") {
              const actor = await isolatedWorker.createActor();
              const db = isolatedWorker.database.owner;
              const event = await db.youngEvent.create({
                data: {
                  youngId: "private-young-1548",
                  name: "Owned private activity 1548",
                  isActive: true,
                  rawJson: {},
                },
              });
              await db.youngNotification.createMany({
                data: Array.from({ length: 25 }, (_, index) => ({
                  id: `private-young-notice-${index}`,
                  userId: actor.id,
                  youngId: event.youngId,
                  kind: "event_changed",
                  title: `Owned private reminder ${index}`,
                  body: "Owned private notification body",
                  dedupeKey: `private-notice-${index}`,
                  createdAt: new Date(Date.UTC(2026, 8, 24, 0, 25 - index)),
                })),
              });
              await page.context().addCookies([
                { ...actor.cookie, url: isolatedWorker.origin },
                {
                  name: "NEXT_LOCALE",
                  value: "en-us",
                  url: isolatedWorker.origin,
                },
              ]);
            } else await demo(page, isolatedWorker.origin);
            const captured = createDeferred(),
              release = createDeferred();
            void captured.promise.catch(() => undefined);
            const operations: Promise<void>[] = [],
              errors: unknown[] = [];
            let held: Request | undefined, terminal: string | undefined;
            const finished = (request: Request) => {
              if (request === held) terminal = "finished";
            };
            const failed = (request: Request) => {
              if (request === held) terminal = "failed";
            };
            const closing = () => {
              release.resolve();
              captured.reject(new Error("Closed before notification capture"));
            };
            const pattern =
              /\/workspace\/subscriptions\/activities\/__data\.json\?.*page=2/;
            const handler = (route: Route) => {
              const operation = (async () => {
                if (held) {
                  await route.continue();
                  return;
                }
                const response = await route.fetch({ maxRedirects: 0 });
                expect(response.status()).toBe(200);
                const data = decoded(await response.json());
                if (
                  !isRecord(data.notifications) ||
                  !isRecord(data.notifications.pagination) ||
                  !Array.isArray(data.notifications.data)
                )
                  throw new Error("Missing genuine notification page");
                expect(data.notifications.pagination.total).toBe(
                  mode === "ordinary" ? 25 : 23,
                );
                expect(data.notifications.data).toHaveLength(
                  mode === "ordinary" ? 5 : 3,
                );
                expect(JSON.stringify(data.notifications.data)).toContain(
                  mode === "ordinary" ? "Owned private reminder" : "Fictional",
                );
                held = route.request();
                captured.resolve();
                await release.promise;
                await route.fulfill({ response }).catch((error: unknown) => {
                  if (
                    route.request().failure()?.errorText !== "net::ERR_ABORTED"
                  )
                    throw error;
                });
              })();
              operations.push(operation);
              void operation.catch((error) => {
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
              await gotoAndWaitForReady(page, `${root}?view=notifications`);
              await expect(row(page, "notifications")).toHaveCount(20);
              await page.evaluate(() =>
                Object.assign(window, {
                  youngWorkspaceDocument: true,
                  youngWorkspaceMain: document.querySelector("#main-content"),
                }),
              );
              await page
                .locator('[data-slot="endless-scroll"]')
                .scrollIntoViewIfNeeded();
              await captured.promise;
              if (mode === "ordinary") await demo(page, isolatedWorker.origin);
              else
                await page.context().addCookies([
                  {
                    name: "NEXT_LOCALE",
                    value: "zh-cn",
                    url: isolatedWorker.origin,
                  },
                ]);
              await page
                .getByRole("radio", { name: "Unread only", exact: true })
                .click();
              await expect(page).toHaveURL(
                `${root}?view=notifications&unread=true`,
              );
              await expect(
                page.getByTestId("demo-young-workspace-fictional"),
              ).toHaveText(
                mode === "ordinary"
                  ? "Fixed fictional subscriptions and notifications."
                  : "固定虚构的订阅和通知样例。",
              );
              await expect(page.getByTestId("demo-notice")).toContainText(
                mode === "ordinary"
                  ? "Changes and external actions are disabled."
                  : "无法修改数据或执行外部操作。",
              );
              const currentRows = row(page, "notifications");
              await expect
                .poll(() => currentRows.count())
                .toBeGreaterThanOrEqual(20);
              if ((await currentRows.count()) === 20)
                await page
                  .locator('[data-slot="endless-scroll"]')
                  .scrollIntoViewIfNeeded();
              await expect(currentRows).toHaveCount(21);
              expect(
                await currentRows.evaluateAll((nodes) =>
                  nodes.map((node) => node.getAttribute("data-record-id")),
                ),
              ).toEqual(unreadNotificationIds);
              const oldText =
                mode === "ordinary" ? "Owned private" : "Fictional";
              await expect(page.locator("#main-content")).not.toContainText(
                oldText,
              );
              const bootstrap = await page.request.get(
                "/_internal/shell-bootstrap",
              );
              expect(await bootstrap.json()).toMatchObject({
                viewer: null,
                navigation: { unreadActivityNotificationsCount: 21 },
              });
              await page.evaluate(
                ({ oldText, privateMode }) => {
                  const main = document.querySelector("#main-content");
                  if (!main) throw new Error("Missing main");
                  const state = {
                    leak: false,
                    observer: null as MutationObserver | null,
                  };
                  state.observer = new MutationObserver((records) => {
                    if (
                      main.textContent?.includes(oldText) ||
                      (privateMode &&
                        document.querySelector(
                          'summary[data-shell-count-value="25"]',
                        ))
                    )
                      state.leak = true;
                    for (const record of records) {
                      if (
                        record.oldValue?.includes(oldText) ||
                        (privateMode &&
                          record.type === "attributes" &&
                          record.attributeName === "data-shell-count-value" &&
                          record.oldValue === "25")
                      )
                        state.leak = true;
                      for (const node of [
                        ...record.addedNodes,
                        ...record.removedNodes,
                      ]) {
                        if (node.textContent?.includes(oldText))
                          state.leak = true;
                        if (
                          privateMode &&
                          node instanceof Element &&
                          (node.matches('[data-shell-count-value="25"]') ||
                            node.querySelector('[data-shell-count-value="25"]'))
                        )
                          state.leak = true;
                      }
                    }
                  });
                  state.observer.observe(document.body, {
                    subtree: true,
                    childList: true,
                    characterData: true,
                    characterDataOldValue: true,
                    attributes: true,
                    attributeOldValue: true,
                    attributeFilter: ["data-shell-count-value"],
                  });
                  Object.assign(window, { youngWorkspaceLate: state });
                },
                { oldText, privateMode: mode === "ordinary" },
              );
              release.resolve();
              await Promise.all(operations);
              await expect.poll(() => terminal).toMatch(/finished|failed/);
              if (terminal === "failed")
                expect(held?.failure()?.errorText).toBe("net::ERR_ABORTED");
              await expect(row(page, "notifications")).toHaveCount(21);
              expect(
                await row(page, "notifications").evaluateAll((nodes) =>
                  nodes.map((node) => node.getAttribute("data-record-id")),
                ),
              ).toEqual(unreadNotificationIds);
              await expect(page.locator("#main-content")).not.toContainText(
                oldText,
              );
              expect(
                await page.evaluate(() => {
                  const state = window as typeof window & {
                    youngWorkspaceDocument?: boolean;
                    youngWorkspaceMain?: Element;
                    youngWorkspaceLate: {
                      leak: boolean;
                      observer: MutationObserver;
                    };
                  };
                  state.youngWorkspaceLate.observer.disconnect();
                  return {
                    sameDocument: state.youngWorkspaceDocument === true,
                    sameMain:
                      state.youngWorkspaceMain ===
                      document.querySelector("#main-content"),
                    leak: state.youngWorkspaceLate.leak,
                  };
                }),
              ).toEqual({ sameDocument: true, sameMain: true, leak: false });
            } catch (error) {
              if (!errors.includes(error)) errors.push(error);
            } finally {
              release.resolve();
              captured.reject(new Error("Notification control finished"));
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
                "Held activity notification workflow failed",
              );
          }),
        ),
      ),
    );
  });
}

test("demo young workspace uses native locale, exit and re-entry", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await demo(page, isolatedWorker.origin);
          await gotoAndWaitForReady(page, `${root}?view=events`);
          await page.evaluate(() =>
            Object.assign(window, { activityLocaleDocument: true }),
          );
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
          await waitForUiSettled(page);
          expect(
            await page.evaluate(() => "activityLocaleDocument" in window),
          ).toBe(false);
          await expect(row(page, "events").first()).toContainText(
            "虚构代数讨论",
          );
          await page.evaluate(() =>
            Object.assign(window, { activityExitDocument: true }),
          );
          await page
            .getByRole("button", { name: "退出演示", exact: true })
            .click();
          await expect(page).toHaveURL(/\/account\/sign-in$/);
          await waitForUiSettled(page);
          expect(
            await page.evaluate(() => "activityExitDocument" in window),
          ).toBe(false);
          await expect(page.getByTestId("demo-notice")).toHaveCount(0);
          await expect(row(page, "events")).toHaveCount(0);
          await page
            .getByRole("button", { name: "进入演示", exact: true })
            .click();
          await expect(page).toHaveURL(/\/workspace\/todos$/);
          await gotoAndWaitForReady(
            page,
            `${root}?view=notifications&unread=true`,
          );
          await expect(row(page, "notifications")).toHaveCount(20);
          await expect(
            page.getByTestId("demo-young-workspace-fictional"),
          ).toHaveText("固定虚构的订阅和通知样例。");
          await expect(page.getByTestId("demo-notice")).toContainText(
            "无法修改数据或执行外部操作。",
          );
          const bootstrap = await page.request.get(
            "/_internal/shell-bootstrap",
          );
          expect(await bootstrap.json()).toMatchObject({
            viewer: null,
            navigation: {
              unreadActivityNotificationsCount: 21,
              calendarItemsCount: 30,
            },
          });
        }),
      ),
    ),
  );
});

test("demo young workspace calendar and public detail share membership", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await page.setViewportSize({ width: 1280, height: 844 });
          await demo(page, isolatedWorker.origin);
          await gotoAndWaitForReady(page, `${root}?view=events`);
          await page
            .getByRole("link", { name: "Personal calendar", exact: true })
            .click();
          await expect(page).toHaveURL(/\/workspace\/calendar/);
          await page.getByRole("radio", { name: "Day", exact: true }).click();
          const link = page
            .getByTestId("calendar-agenda")
            .locator('a[href="/catalog/young-events/demo-young-28"]');
          await expect(link).toHaveCount(1);
          await link.scrollIntoViewIfNeeded();
          await expect(link).toBeVisible();
          await expect(link).toContainText("Fictional activity 28");
          await expect(link).toContainText(/09:30.*10:30/);
          await link.click();
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "Fictional activity 28",
          );
          const facts = page.getByTestId("demo-young-subscription-facts");
          await expect(facts).toHaveCount(1);
          await expect(facts.getByRole("checkbox")).toBeChecked();
          await expect(facts.getByRole("checkbox")).toBeDisabled();
          const manage = page.getByRole("link", {
            name: "Activity subscriptions",
            exact: true,
          });
          await expect(manage).toHaveCount(1);
          await expect(manage).toHaveAttribute(
            "href",
            `${root}?view=notifications`,
          );
          await manage.click();
          await expect(page).toHaveURL(`${root}?view=notifications`);
          const eventsLink = page.getByRole("link", {
            name: "Subscribed activities",
            exact: true,
          });
          await expect(eventsLink).toHaveCount(1);
          await expect(eventsLink).toHaveAttribute(
            "href",
            `${root}?view=events`,
          );
          await eventsLink.click();
          await expect(page).toHaveURL(`${root}?view=events`);
          await expect(row(page, "events")).toHaveCount(20);
          await expect(
            row(page, "events").filter({
              has: page.locator('[href="/catalog/young-events/demo-young-28"]'),
            }),
          ).toContainText("Fictional activity 28");
          const subscription = row(page, "events").filter({
            has: page.locator('[href="/catalog/young-events/demo-young-28"]'),
          });
          await subscription
            .getByRole("button", { name: "Reminder settings", exact: true })
            .click();
          await expect(subscription.getByRole("checkbox")).toHaveCount(4);
          for (const flag of await subscription.getByRole("checkbox").all()) {
            await expect(flag).toBeChecked();
            await expect(flag).toBeDisabled();
          }
          await expect(
            subscription.getByRole("button", {
              name: "Save reminders",
              exact: true,
            }),
          ).toBeDisabled();
        }),
      ),
    ),
  );
});

test("demo young workspace retires an admitted ordinary subscription write", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await page.setViewportSize({ width: 1280, height: 844 });
          const db = isolatedWorker.database.owner,
            actor = await isolatedWorker.createActor();
          const event = await db.youngEvent.create({
            data: {
              youngId: "demo-young-1",
              name: "Owned ordinary subscription target",
              isActive: true,
              rawJson: {},
            },
          });
          await db.userYoungEventSubscription.create({
            data: {
              userId: actor.id,
              youngId: event.youngId,
              observedState: "owned ordinary fixture",
              remindSignup: false,
              remindDeadline: false,
              remindStart: false,
            },
          });
          await page.context().addCookies([
            { ...actor.cookie, url: isolatedWorker.origin },
            { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
          ]);
          const captured = createDeferred(),
            release = createDeferred();
          void captured.promise.catch(() => undefined);
          const operations: Promise<void>[] = [],
            errors: unknown[] = [];
          let held: Request | undefined, terminal: string | undefined;
          let originalDocument: JSHandle<Document> | undefined;
          const endpoint =
            "/api/workspace/young-event-subscriptions/demo-young-1";
          const finished = (request: Request) => {
            if (request === held) terminal = "finished";
          };
          const failed = (request: Request) => {
            if (request === held) terminal = "failed";
          };
          const closing = () => {
            release.resolve();
            captured.reject(new Error("Closed before admitted PUT capture"));
          };
          const handler = (route: Route) => {
            const operation = (async () => {
              if (route.request().method() !== "PUT") {
                await route.continue();
                return;
              }
              expect(route.request().postDataJSON()).toMatchObject({
                subscribed: false,
              });
              const response = await route.fetch({ maxRedirects: 0 });
              expect(response.status()).toBe(200);
              expect(await response.json()).toEqual({
                youngId: event.youngId,
                subscribed: false,
                remindSignup: false,
                remindDeadline: false,
                remindStart: false,
              });
              held = route.request();
              captured.resolve();
              await release.promise;
              // An already admitted ordinary write must complete; never abort it to hide its result.
              await route.fulfill({ response });
            })();
            operations.push(operation);
            void operation.catch((error) => {
              errors.push(error);
              captured.reject(error);
            });
            return operation;
          };
          const pattern = `**${endpoint}`;
          const invalidations: string[] = [];
          let observing = false;
          const observe = (request: Request) => {
            if (
              observing &&
              request.method() === "GET" &&
              new URL(request.url()).pathname.endsWith("/__data.json")
            )
              invalidations.push(request.url());
          };
          try {
            page.on("close", closing);
            page.on("requestfinished", finished);
            page.on("requestfailed", failed);
            page.on("request", observe);
            await page.route(pattern, handler);
            await gotoAndWaitForReady(
              page,
              "/catalog/young-events/demo-young-1",
            );
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "Owned ordinary subscription target",
            );
            originalDocument = await page.evaluateHandle(() => document);
            const unsubscribe = page
              .locator("#main-content")
              .getByRole("button", {
                name: "Unsubscribe from activity",
                exact: true,
              });
            await expect(unsubscribe).toHaveCount(1);
            await unsubscribe.click();
            await captured.promise;
            expect(
              await db.userYoungEventSubscription.findUnique({
                where: {
                  userId_youngId: { userId: actor.id, youngId: event.youngId },
                },
              }),
            ).toBeNull();
            await demo(page, isolatedWorker.origin);
            const manage = page.getByRole("link", {
              name: "Activity subscriptions",
              exact: true,
            });
            await expect(manage).toHaveCount(1);
            await expect(manage).toHaveAttribute(
              "href",
              `${root}?view=notifications`,
            );
            await manage.click();
            await expect(page).toHaveURL(`${root}?view=notifications`);
            const eventsLink = page.getByRole("link", {
              name: "Subscribed activities",
              exact: true,
            });
            await expect(eventsLink).toHaveCount(1);
            await expect(eventsLink).toHaveAttribute(
              "href",
              `${root}?view=events`,
            );
            await eventsLink.click();
            await expect(page.getByTestId("demo-notice")).toBeVisible();
            await row(page, "events")
              .first()
              .getByRole("link", {
                name: "Fictional algebra discussion",
                exact: true,
              })
              .click();
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "Fictional algebra discussion",
            );
            expect(
              await originalDocument.evaluate((doc) => doc === document),
            ).toBe(true);
            const facts = page
              .getByTestId("demo-young-subscription-facts")
              .getByRole("checkbox");
            await expect(facts).toBeChecked();
            await expect(facts).toBeDisabled();
            await waitForUiSettled(page);
            observing = true;
            release.resolve();
            await Promise.all(operations);
            await expect.poll(() => terminal).toBe("finished");
            await page
              .getByRole("button", { name: "My day", exact: true })
              .click();
            await waitForUiSettled(page);
            await expect(facts).toBeChecked();
            await expect(page.getByText("Saved", { exact: true })).toHaveCount(
              0,
            );
            expect(invalidations).toEqual([]);
            expect(
              await db.userYoungEventSubscription.findUnique({
                where: {
                  userId_youngId: { userId: actor.id, youngId: event.youngId },
                },
              }),
            ).toBeNull();
          } catch (error) {
            if (!errors.includes(error)) errors.push(error);
          } finally {
            release.resolve();
            captured.reject(new Error("Admitted PUT control finished"));
            try {
              await page.unroute(pattern);
            } catch (error) {
              errors.push(error);
            }
            await Promise.allSettled(operations);
            page.off("close", closing);
            page.off("requestfinished", finished);
            page.off("requestfailed", failed);
            page.off("request", observe);
            await originalDocument?.dispose();
          }
          if (errors.length)
            throw new AggregateError(
              errors,
              "Admitted ordinary subscription workflow failed",
            );
        }),
      ),
    ),
  );
});
