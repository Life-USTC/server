import { expect } from "@playwright/test";
import { test } from "../../../../../utils/activity-fixture";
import { openCommentComposer } from "../../../../../utils/comments";
import {
  expandWorkspaceSidebarGroup,
  sidebarNavigationLink,
} from "../../../../../utils/locators";
import { observeAction } from "../../../../../utils/observed-action";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../../utils/page-ready";

test("活动、主办方订阅和提醒入口可用", async ({
  page,
  activity,
  activityConsumer,
  activityRun,
}, testInfo) => {
  await activityRun(async () => {
    const response = await gotoAndWaitForReady(
      page,
      "/workspace/subscriptions/activities",
      {
        browserHealth: {},
        expectMeaningfulContent: true,
        expectNoHorizontalOverflow: true,
        uiQuality: {},
        testInfo,
      },
    );
    expect(response?.ok()).toBe(true);
    await expandWorkspaceSidebarGroup(page);
    await expect(sidebarNavigationLink(page, /^(今天|Today)$/i)).toBeVisible();
    // This consumer starts from independently arranged state; it never relies on
    // one of the subscription mutation journeys having run first.
    const views = [
      {
        view: "events",
        title: activity.name,
        href: `/catalog/young-events/${activity.youngId}`,
      },
      {
        view: "organizers",
        title: activityConsumer.organizerName,
        href: `/catalog/young-events/organizers/${activityConsumer.organizerId}`,
      },
      {
        view: "notifications",
        title: activityConsumer.notificationTitle,
        href: `/catalog/young-events/${activity.youngId}`,
      },
    ];
    for (const { view, title, href } of views) {
      await page.locator(`nav a[href="?view=${view}"]`).click();
      await expect(page).toHaveURL(new RegExp(`view=${view}`));
      await expect(page.locator("main")).toBeVisible();
      const link = page
        .locator("main")
        .getByRole("link", { name: title, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    }
  });
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  for (const action of ["add", "settings", "remove"] as const) {
    test(`activity subscription ${action} persists at ${viewport.width}px`, async ({
      page,
      account,
      activity,
      activityRun,
      activityDb,
    }) => {
      const youngId = activity.youngId;
      const initial = {
        userId: account.id,
        youngId,
        remindSignup: true,
        remindDeadline: action !== "remove",
        remindStart: true,
      };
      // Settings and removal each start from their own directly seeded membership.
      if (action !== "add")
        await activityDb((db) =>
          db.userYoungEventSubscription.create({
            data: {
              ...initial,
              observedState: JSON.stringify([
                activity.name,
                null,
                null,
                null,
                false,
                activity.startAt?.toISOString(),
                activity.endAt?.toISOString(),
                null,
                null,
              ]),
            },
          }),
        );
      const subscriptions = () =>
        activityDb((db) =>
          db.userYoungEventSubscription.findMany({
            where: { userId: account.id },
            select: {
              userId: true,
              youngId: true,
              remindSignup: true,
              remindDeadline: true,
              remindStart: true,
            },
          }),
        );
      await activityRun(async (settleActivityEffects) => {
        expect(await subscriptions()).toEqual(
          action === "add" ? [] : [initial],
        );
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize(viewport);
        const reminder = page.getByRole("checkbox", {
          name: /报名截止前|registration closes/i,
        });
        if (action !== "remove") {
          await gotoAndWaitForReady(page, `/catalog/young-events/${youngId}`);
          await settleActivityEffects();
          if (action === "add") {
            await page
              .getByRole("button", { name: /^(订阅活动|Subscribe to event)$/ })
              .click();
            await expect(
              page.getByRole("button", { name: /^(取消订阅|Unsubscribe)$/ }),
            ).toBeVisible();
          } else {
            await expect(reminder).toBeHidden();
            await page
              .getByRole("button", { name: /^(提醒设置|Reminder settings)$/ })
              .click();
            await reminder.uncheck();
            await observeAction(
              () =>
                page.waitForResponse(
                  (response) =>
                    response
                      .url()
                      .endsWith(
                        `/api/workspace/young-event-subscriptions/${youngId}`,
                      ) && response.request().method() === "PUT",
                ),
              () =>
                page
                  .getByRole("button", {
                    name: /^(保存提醒设置|Save reminders)$/,
                  })
                  .click(),
            );
            await expect(
              page.getByRole("button", {
                name: /^(保存提醒设置|Save reminders)$/,
              }),
            ).toBeEnabled();
          }
          expect(await subscriptions()).toEqual([
            { ...initial, remindDeadline: action === "add" },
          ]);
          await settleActivityEffects();
          await page.reload();
          await waitForUiSettled(page);
          await expect(reminder).toBeHidden();
          await page
            .getByRole("button", { name: /^(提醒设置|Reminder settings)$/ })
            .click();
          await expect(reminder).toBeChecked({ checked: action === "add" });
        }
        const link = page.getByRole("link", {
          name: activity.name,
          exact: true,
        });
        const remove = page.getByRole("button", {
          name: /^(取消订阅|Unsubscribe)$/,
        });
        if (action === "remove") {
          await gotoAndWaitForReady(
            page,
            "/workspace/subscriptions/activities",
          );
          await expect(link).toBeVisible();
          await expect(page.getByRole("checkbox")).toHaveCount(0);
          await expect(remove).toBeEnabled();
          await page.screenshot({
            path: test
              .info()
              .outputPath(`young-subscriptions-remove-${viewport.width}.png`),
            fullPage: true,
          });
        }
        // Check the detail or subscription-list page that owns this operation.
        await expect(page.locator("vite-error-overlay")).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        if (action === "remove") {
          await remove.click();
          await expect(link).toHaveCount(0);
          expect(await subscriptions()).toEqual([]);
          await settleActivityEffects();
          await page.reload();
          await waitForUiSettled(page);
          await expect(link).toHaveCount(0);
        }
        expect(await subscriptions()).toEqual(
          action === "remove"
            ? []
            : [{ ...initial, remindDeadline: action === "add" }],
        );
        expect(errors).toEqual([]);
      });
    });
  }
}

test("activity detail posts comments to the public youngId and preserves them on reload", async ({
  page,
  account,
  activity,
  activityRun,
  activityDb,
}) => {
  await activityRun(async () => {
    const body = "Independent public activity comment";
    await gotoAndWaitForReady(
      page,
      `/catalog/young-events/${activity.youngId}`,
    );
    const composer = await openCommentComposer(page);
    await composer.fill(body);
    const created = await observeAction(
      () =>
        page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/community/comments") &&
            r.request().method() === "POST",
        ),
      () =>
        page
          .locator("#comments")
          .getByRole("button", { name: /发布评论|Post comment/i })
          .click(),
    );
    expect(created.request().postDataJSON()).toMatchObject({
      targetType: "young-event",
      youngId: activity.youngId,
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).id;
    expect(
      await activityDb((db) => db.comment.findUniqueOrThrow({ where: { id } })),
    ).toMatchObject({
      userId: account.id,
      youngEventId: activity.id,
      body,
      status: "active",
      visibility: "public",
    });
    await expect(
      page.locator("#comments").getByText(body, { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.locator("#comments").getByText(body, { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("young-comments.png"),
      fullPage: true,
    });
  });
});

for (const locale of ["zh-cn", "en-us"] as const) {
  test(`activity reminders filter, localize and persist read state in ${locale}`, async ({
    page,
    account,
    activity,
    baseURL,
    activityRun,
    activityDb,
  }) => {
    await activityRun(async () => {
      const marker = activity.youngId;
      if (!baseURL) throw new Error("Activity browser tests require baseURL");
      await page
        .context()
        .addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
      await page.setViewportSize({ width: 390, height: 844 });
      const createdAt = new Date();
      await activityDb((db) =>
        db.youngNotification.create({
          data: {
            id: marker,
            userId: account.id,
            youngId: marker,
            kind: "signup_deadline",
            title: marker,
            body: "报名即将截止 / Registration closes soon",
            createdAt,
            dedupeKey: marker,
          },
        }),
      );
      const notifications = () =>
        activityDb((db) =>
          db.youngNotification.findMany({ where: { userId: account.id } }),
        );
      const before = await notifications();
      expect(before).toEqual([
        expect.objectContaining({
          id: marker,
          userId: account.id,
          youngId: marker,
          readAt: null,
        }),
      ]);
      await gotoAndWaitForReady(
        page,
        "/workspace/subscriptions/activities?view=notifications&unread=true",
      );
      const card = page
        .locator('[data-slot="item"]')
        .filter({ has: page.getByRole("link", { name: marker, exact: true }) });
      await expect(card).toBeVisible();
      const unreadFilter = page.getByRole("radio", {
        name: /^(仅未读|Unread only)$/,
      });
      await expect(unreadFilter).toBeChecked();
      await unreadFilter.click();
      await expect(unreadFilter).toBeChecked();
      await expect(page).toHaveURL(/unread=true/);
      await expect(
        card.getByText(
          locale === "zh-cn" ? "报名即将截止" : "Registration deadline",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        card.getByText("报名即将截止 / Registration closes soon", {
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(card.locator("time")).toHaveAttribute("datetime", /T/);
      await expect(
        card.getByRole("link", { name: /^(查看活动|View activity)$/ }),
      ).toHaveAttribute("href", `/catalog/young-events/${marker}`);
      const read = card.getByRole("button", { name: /^(标记已读|Mark read)$/ });
      const failureNotice = page.getByText(
        /操作失败，请重试|Could not complete the request/,
      );
      const failures = [
        { status: 503, body: "unavailable" },
        { status: 200, contentType: "application/json", body: "{" },
        {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: `${marker}-other`, success: true }),
        },
        {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: marker, success: false }),
        },
      ];
      for (const [index, failure] of failures.entries()) {
        // A stale toast must not satisfy the next failed acknowledgement.
        if (index > 0) {
          await page.reload();
          await waitForUiSettled(page);
        }
        await expect(failureNotice).toHaveCount(0);
        await expect(card).toBeVisible();
        await expect(read).toBeEnabled();
        await page.route(
          `**/api/workspace/young-notifications/${marker}/read`,
          (route) => route.fulfill(failure),
          { times: 1 },
        );
        await read.click();
        await expect(failureNotice).toBeVisible();
        await expect(read).toBeEnabled();
        await expect(card).toBeVisible();
        expect(await notifications()).toEqual(before);
      }
      await read.click();
      await expect(card).toHaveCount(0);
      await page
        .getByRole("radio", { name: /^(全部提醒|All reminders)$/ })
        .click();
      await expect(page).not.toHaveURL(/unread=true/);
      await expect(card).toBeVisible();
      await expect(read).toHaveCount(0);
      expect(await notifications()).toEqual([
        { ...before[0], readAt: expect.any(Date) },
      ]);
      await page.reload();
      await expect(card).toBeVisible();
      await expect(read).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });
  });
}

test("reading the last unread reminder on page two returns to the remaining reminders", async ({
  page,
  account,
  activity,
  activityRun,
  activityDb,
}) => {
  await activityRun(async () => {
    const marker = activity.youngId;
    const createdAt = Date.now();
    const notifications = () =>
      activityDb((db) =>
        db.youngNotification.findMany({
          where: { userId: account.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, userId: true, readAt: true },
        }),
      );
    await activityDb((db) =>
      db.youngNotification.createMany({
        data: Array.from({ length: 21 }, (_, index) => ({
          id: `${marker}-${index}`,
          userId: account.id,
          youngId: marker,
          kind: "event_changed",
          title: `${marker} ${index}`,
          body: "Activity details changed",
          createdAt: new Date(createdAt - index * 1000),
          dedupeKey: `${marker}-${index}`,
        })),
      }),
    );
    const before = await notifications();
    expect(before).toEqual(
      Array.from({ length: 21 }, (_, index) => ({
        id: `${marker}-${index}`,
        userId: account.id,
        readAt: null,
      })),
    );
    await gotoAndWaitForReady(
      page,
      "/workspace/subscriptions/activities?view=notifications&unread=true&page=2",
    );
    await expect(
      page.getByRole("link", { name: `${marker} 20`, exact: true }),
    ).toBeVisible();
    const reminderNavigation = page
      .locator('[data-shell-navigation="desktop"]')
      .getByRole("link", { name: /^(活动提醒|Activity reminders)$/ });
    await expect(reminderNavigation).toHaveAttribute("aria-current", "page");
    const reminderBadge = page
      .locator(
        '[data-shell-navigation="desktop"] [data-slot="sidebar-menu-item"]',
      )
      .filter({
        has: page.getByRole("link", {
          name: /^(活动提醒|Activity reminders)$/,
        }),
      })
      .locator('[data-slot="sidebar-menu-badge"]');
    await expect(reminderBadge).toHaveText("21");
    await page
      .locator("main")
      .getByRole("button", { name: /^(标记已读|Mark read)$/ })
      .click();
    await expect(page).toHaveURL(/view=notifications&unread=true&page=1/);
    await expect(reminderBadge).toHaveText("20");
    expect(await notifications()).toEqual(
      before.map((item, index) => ({
        ...item,
        readAt: index === 20 ? expect.any(Date) : null,
      })),
    );
    await expect(
      page.getByRole("link", { name: `${marker} 0`, exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator("main")
        .getByRole("button", { name: /^(标记已读|Mark read)$/ }),
    ).toHaveCount(20);
    await expect(
      page.getByText(/已读完所有提醒|You’re all caught up/),
    ).toHaveCount(0);
    await expect(
      page.getByRole("radio", { name: /^(仅未读|Unread only)$/ }),
    ).toBeChecked();
  });
});
