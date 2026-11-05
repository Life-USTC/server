import { expect } from "@playwright/test";
import { createDeferred } from "../../../../../shared/deferred";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import {
  getUserSubscribedSectionIds,
  test,
} from "../../../../utils/section-subscription-fixture";

for (const width of [1280, 390]) {
  test(
    `section cancellation requires confirmation ${width}`,
    { tag: "@Subscription/Web" },
    async (
      { page, sectionRun, memberSection: section, isolatedWorker },
      testInfo,
    ) => {
      await sectionRun({ writes: [], calendar: null }, async () => {
        const db = isolatedWorker.database.owner;
        await db.userSectionSubscription.create({
          data: { userId: section.userId, sectionId: section.id },
        });
        await page.setViewportSize({ width, height: 900 });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: "zh-cn", url: isolatedWorker.origin },
          ]);
        let attemptedWrites = 0;
        await page.route(
          (url) =>
            url.pathname === section.path && url.search === "?/unsubscribe",
          async (route) => {
            attemptedWrites++;
            await route.abort();
          },
        );
        await gotoAndWaitForReady(page, section.path);
        const trigger = page
          .getByRole("button", { name: "取消订阅教学班", exact: true })
          .filter({ visible: true });
        await expect(trigger).toHaveCount(1);
        await trigger.click();
        await testInfo.attach(`unsubscribe-${width}`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
        const dialog = page.getByRole("alertdialog", {
          name: "确认取消教学班订阅？",
        });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(
          "其课程表、考试与作业将不再出现在你的工作区中",
        );
        expect(attemptedWrites).toBe(0);
        expect(await getUserSubscribedSectionIds(db, section.userId)).toEqual([
          section.id,
        ]);
        await dialog
          .getByRole("button", { name: "保留订阅", exact: true })
          .click();
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        expect(attemptedWrites).toBe(0);
        expect(await getUserSubscribedSectionIds(db, section.userId)).toEqual([
          section.id,
        ]);
      });
    },
  );
}

test("section cancellation stays open during failure and explicit retry", {
  tag: "@Subscription/Web",
}, async ({ page, sectionRun, memberSection: section, isolatedWorker }) => {
  const gate = createDeferred<void>();
  let attempts = 0;
  await sectionRun({ writes: [], calendar: null }, async () => {
    const db = isolatedWorker.database.owner;
    await db.userSectionSubscription.create({
      data: { userId: section.userId, sectionId: section.id },
    });
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page.route(
      (url) => url.pathname === section.path && url.search === "?/unsubscribe",
      async (route) => {
        attempts++;
        if (attempts === 1) await gate.promise;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            type: "failure",
            status: 503,
            data: JSON.stringify([{ error: 1 }, "Temporary rejection"]),
          }),
        });
      },
    );
    try {
      await gotoAndWaitForReady(page, section.path);
      await page
        .getByRole("button", { name: "Unsubscribe from section", exact: true })
        .filter({ visible: true })
        .click();
      const dialog = page.getByRole("alertdialog");
      const confirm = dialog.getByRole("button", {
        name: "Confirm Unsubscribe",
        exact: true,
      });
      const cancel = dialog.getByRole("button", {
        name: "Keep Subscription",
        exact: true,
      });
      await confirm.click();
      await expect.poll(() => attempts).toBe(1);
      await expect(confirm).toBeDisabled();
      await expect(cancel).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      gate.resolve();
      await expect(dialog.getByRole("alert")).toContainText(
        "Failed to remove section",
      );
      await expect(confirm).toBeEnabled();
      expect(await getUserSubscribedSectionIds(db, section.userId)).toEqual([
        section.id,
      ]);
      await confirm.click();
      await expect.poll(() => attempts).toBe(2);
      await expect(dialog.getByRole("alert")).toBeVisible();
      await cancel.click();
      await expect(dialog).toBeHidden();
      expect(await getUserSubscribedSectionIds(db, section.userId)).toEqual([
        section.id,
      ]);
    } finally {
      gate.resolve();
    }
  });
});
