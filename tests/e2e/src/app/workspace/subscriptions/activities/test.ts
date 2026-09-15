import { expect, test } from "@playwright/test";
import { createFixturePrisma } from "../../../../../../shared/prisma";
import { signInAsDebugUser } from "../../../../../utils/auth";
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
      await reminder.uncheck();
      await page
        .getByRole("button", { name: /^(保存提醒设置|Save reminders)$/ })
        .click();
      await page.reload();
      await expect(reminder).not.toBeChecked();
      await gotoAndWaitForReady(page, "/workspace/subscriptions/activities");
      await expect(
        page.getByRole("link", {
          name: "Browser activity subscription",
          exact: true,
        }),
      ).toBeVisible();
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
