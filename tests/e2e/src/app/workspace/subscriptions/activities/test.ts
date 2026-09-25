import { expect, test } from "@playwright/test";
import { createFixturePrisma } from "../../../../../../shared/prisma";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../../utils/auth";
import {
  cleanupCommentsForE2e,
  openCommentComposer,
} from "../../../../../utils/comments";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../../utils/page-ready";
import { assertPageContract } from "../../../_shared/page-contract";

test("活动、主办方订阅和提醒入口可用", async ({ page }, testInfo) => {
  await assertPageContract(page, {
    routePath: "/workspace/subscriptions/activities",
    testInfo,
  });
  await gotoAndWaitForReady(page, "/workspace/subscriptions/activities");
  for (const view of ["events", "organizers", "notifications"]) {
    await page.locator(`nav a[href="?view=${view}"]`).click();
    await expect(page).toHaveURL(new RegExp(`view=${view}`));
    await expect(page.locator("main")).toBeVisible();
  }
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`activity subscription persists settings and removal at ${viewport.width}px`, async ({
    page,
  }) => {
    const fixture = createFixturePrisma();
    const youngId = `young-browser-${crypto.randomUUID()}`;
    await fixture.youngEvent.create({
      data: {
        youngId,
        name: "Browser activity subscription",
        isActive: true,
        rawJson: {},
        startAt: new Date(Date.now() + 3600000),
        endAt: new Date(Date.now() + 7200000),
      },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setViewportSize(viewport);
      await signInAsDebugUser(page, `/catalog/young-events/${youngId}`);
      await gotoAndWaitForReady(page, `/catalog/young-events/${youngId}`);
      await page
        .getByRole("button", { name: /^(订阅活动|Subscribe to event)$/ })
        .click();
      await expect(
        page.getByRole("button", { name: /^(取消订阅|Unsubscribe)$/ }),
      ).toBeVisible();
      const reminder = page.getByRole("checkbox", {
        name: /报名截止前|registration closes/i,
      });
      await expect(reminder).toBeHidden();
      await page
        .getByRole("button", { name: /^(提醒设置|Reminder settings)$/ })
        .click();
      await reminder.uncheck();
      await page
        .getByRole("button", { name: /^(保存提醒设置|Save reminders)$/ })
        .click();
      await page.reload();
      await expect(reminder).toBeHidden();
      await page
        .getByRole("button", { name: /^(提醒设置|Reminder settings)$/ })
        .click();
      await expect(reminder).not.toBeChecked();
      await gotoAndWaitForReady(page, "/workspace/subscriptions/activities");
      await expect(
        page.getByRole("link", {
          name: "Browser activity subscription",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByRole("checkbox")).toHaveCount(0);
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("button", { name: /^(取消订阅|Unsubscribe)$/ }),
      ).toBeEnabled();
      await page.screenshot({
        path: `/tmp/young-subscriptions-${viewport.width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: /^(取消订阅|Unsubscribe)$/ })
        .click();
      await expect(
        page.getByRole("link", {
          name: "Browser activity subscription",
          exact: true,
        }),
      ).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await fixture.userYoungEventSubscription.deleteMany({
        where: { youngId },
      });
      await fixture.youngNotification.deleteMany({ where: { youngId } });
      await fixture.youngEvent.delete({ where: { youngId } });
      await fixture.$disconnect();
    }
  });
}

test("activity detail posts comments to the public youngId and preserves them on reload", async ({
  page,
}) => {
  let id: string | undefined;
  const body = `young-browser-comment-${crypto.randomUUID()}`;
  try {
    await signInAsDevAdmin(
      page,
      `/catalog/young-events/${DEV_SEED.youngEvent.youngId}`,
    );
    const composer = await openCommentComposer(page);
    await composer.fill(body);
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/community/comments") &&
        r.request().method() === "POST",
    );
    await page
      .locator("#comments")
      .getByRole("button", { name: /发布评论|Post comment/i })
      .click();
    const created = await response;
    expect(created.request().postDataJSON()).toMatchObject({
      targetType: "young-event",
      youngId: DEV_SEED.youngEvent.youngId,
    });
    expect(created.status()).toBe(201);
    id = (await created.json()).id;
    await expect(
      page.locator("#comments").getByText(body, { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.locator("#comments").getByText(body, { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "/tmp/young-comments.png", fullPage: true });
  } finally {
    await cleanupCommentsForE2e([id]);
  }
});

for (const locale of ["zh-cn", "en-us"] as const) {
  test(`activity reminders filter, localize and persist read state in ${locale}`, async ({
    page,
  }) => {
    const fixture = createFixturePrisma();
    const marker = `reminder-browser-${crypto.randomUUID()}`;
    await signInAsDebugUser(page, "/workspace/subscriptions/activities");
    const session = await (
      await page.request.get("/api/auth/get-session")
    ).json();
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: locale, url: new URL(page.url()).origin },
      ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await fixture.youngEvent.create({
      data: { youngId: marker, name: marker, isActive: true, rawJson: {} },
    });
    const createdAt = new Date();
    await fixture.youngNotification.create({
      data: {
        id: marker,
        userId: session.user.id,
        youngId: marker,
        kind: "signup_deadline",
        title: marker,
        body: "报名即将截止 / Registration closes soon",
        createdAt,
        dedupeKey: marker,
      },
    });
    try {
      await gotoAndWaitForReady(
        page,
        "/workspace/subscriptions/activities?view=notifications&unread=true",
      );
      const card = page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByRole("link", { name: marker, exact: true }) });
      await expect(card).toBeVisible();
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
      await page.route(
        `**/api/workspace/young-notifications/${marker}/read`,
        (route) => route.fulfill({ status: 503, body: "unavailable" }),
        { times: 1 },
      );
      await read.click();
      await expect(
        page.getByText(/操作失败，请重试|Could not complete the request/),
      ).toBeVisible();
      await expect(card).toBeVisible();
      await read.click();
      await expect(card).toHaveCount(0);
      await page
        .getByRole("radio", { name: /^(全部提醒|All reminders)$/ })
        .click();
      await expect(page).not.toHaveURL(/unread=true/);
      await expect(card).toBeVisible();
      await expect(read).toHaveCount(0);
      expect(
        (
          await fixture.youngNotification.findUniqueOrThrow({
            where: { id: marker },
          })
        ).readAt,
      ).not.toBeNull();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    } finally {
      await fixture.youngNotification.deleteMany({ where: { id: marker } });
      await fixture.youngEvent.delete({ where: { youngId: marker } });
      await fixture.$disconnect();
    }
  });
}
