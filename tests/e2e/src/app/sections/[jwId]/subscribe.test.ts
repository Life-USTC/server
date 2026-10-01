import { expect } from "@playwright/test";
import { observeAction } from "../../../../utils/observed-action";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import {
  getUserSubscribedSectionIds,
  test,
} from "../../../../utils/section-subscription-fixture";

const subscribeName = /订阅教学班|Subscribe to section/i;
const unsubscribeName = /取消订阅|Unsubscribe from section/i;

test("匿名订阅入口说明非选课含义并要求登录", async ({
  sectionRun,
  page,
  section,
}, testInfo) => {
  await sectionRun({ writes: [], calendar: null }, async () => {
    await gotoAndWaitForReady(page, section.path);
    await expect(
      page.getByRole("button", { name: /enroll|报名选课/i }),
    ).toHaveCount(0);
    const subscribe = page.getByRole("button", { name: subscribeName }).first();
    await expect(subscribe).toBeVisible();
    await expect(
      page.getByRole("button", { name: unsubscribeName }),
    ).toHaveCount(0);
    await subscribe.click();
    const dialog = page
      .getByRole("dialog")
      .or(page.getByRole("alertdialog"))
      .first();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/非官方|非正式|not.*official|not.*enrollment/i).first(),
    ).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: /登录|Sign in/i }),
    ).toBeVisible();
    await captureStepScreenshot(
      page,
      testInfo,
      "section/subscribe-login-required",
    );
  });
});

test("section.retired-detail-presentation", async ({
  sectionRun,
  page,
  section,
  isolatedWorker,
}) => {
  await sectionRun({ writes: [], calendar: null }, async () => {
    await isolatedWorker.database.owner.section.update({
      where: { id: section.id },
      data: { retiredAt: new Date("2026-01-01T00:00:00Z") },
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAndWaitForReady(page, `${section.path}?subscribe=1`);
    await expect(
      page.getByText(/历史班级|Historical section/i).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: subscribeName })).toHaveCount(
      0,
    );
    await expect(
      page
        .getByTestId("detail-pinned-summary")
        .getByRole("button", { name: /添加到日历|Add to calendar/i }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test("已订阅用户仍可取消订阅已退役教学班", async ({
  sectionRun,
  page,
  memberSection: section,
  isolatedWorker,
}) => {
  await sectionRun(
    {
      writes: [
        { action: "unsubscribe", userId: section.userId, subscribedIds: [] },
      ],
      calendar: {
        userId: section.userId,
        messages: [{ type: "user", userId: section.userId }],
      },
    },
    async () => {
      const db = isolatedWorker.database.owner;
      await db.$transaction([
        db.section.update({
          where: { id: section.id },
          data: { retiredAt: new Date("2026-01-01T00:00:00Z") },
        }),
        db.userSectionSubscription.create({
          data: { userId: section.userId, sectionId: section.id },
        }),
      ]);
      await gotoAndWaitForReady(page, "/workspace/subscriptions");
      const workspaceLink = page
        .getByTestId("subscription-course-link")
        .and(page.locator(`a[href="${section.path}"]`))
        .filter({ visible: true });
      await expect(workspaceLink).toBeVisible();
      await workspaceLink.click();
      await expect(page).toHaveURL(new RegExp(`${section.path}$`));
      await waitForUiSettled(page);
      await expect(
        page.getByText(/历史班级|Historical section/i).first(),
      ).toBeVisible();
      const unsubscribe = page.getByRole("button", { name: unsubscribeName });
      await expect(unsubscribe.first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: subscribeName }),
      ).toHaveCount(0);
      // Retired sections have no subscribe button to signal that the enhanced
      // action's viewer refresh has completed before leaving this document.
      const refreshedViewer = await observeAction(
        () =>
          page.waitForResponse(
            (response) =>
              response.request().method() === "GET" &&
              new URL(response.url()).pathname ===
                `/_internal/catalog/sections/${section.jwId}/viewer` &&
              response.status() === 200,
          ),
        () => unsubscribe.first().click(),
      );
      expect((await refreshedViewer.json()).viewer).toEqual({
        signedIn: true,
        isSubscribed: false,
      });
      await expect
        .poll(() => getUserSubscribedSectionIds(db, section.userId))
        .toEqual([]);
      await expect(unsubscribe).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: subscribeName }),
      ).toHaveCount(0);
      await gotoAndWaitForReady(page, "/workspace/subscriptions");
      await expect(workspaceLink).toHaveCount(0);
    },
  );
});

test("已登录用户订阅后更新详情控件与工作区列表", async ({
  sectionRun,
  page,
  memberSection: section,
  isolatedWorker,
}, testInfo) => {
  await sectionRun(
    {
      writes: [
        {
          action: "subscribe",
          userId: section.userId,
          subscribedIds: [section.id],
        },
      ],
      calendar: {
        userId: section.userId,
        messages: [{ type: "user", userId: section.userId }],
      },
    },
    async () => {
      const db = isolatedWorker.database.owner;
      expect(await getUserSubscribedSectionIds(db, section.userId)).toEqual([]);
      await gotoAndWaitForReady(page, section.path);
      const subscribe = page.getByRole("button", { name: subscribeName });
      const unsubscribe = page.getByRole("button", { name: unsubscribeName });
      await expect(subscribe.first()).toBeVisible();
      await expect(unsubscribe).toHaveCount(0);
      await subscribe.first().click();
      const dialog = page.getByRole("dialog").first();
      await expect(dialog).toBeVisible();
      await expect(
        dialog
          .getByText(/非官方|非正式|not.*official|not.*enrollment/i)
          .first(),
      ).toBeVisible();
      await dialog.getByRole("button", { name: subscribeName }).click();
      await expect(unsubscribe.first()).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(() => getUserSubscribedSectionIds(db, section.userId))
        .toEqual([section.id]);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await captureStepScreenshot(page, testInfo, "section/subscribed");

      await gotoAndWaitForReady(page, "/workspace/subscriptions");
      const workspaceLink = page
        .getByTestId("subscription-course-link")
        .and(page.locator(`a[href="${section.path}"]`))
        .filter({ visible: true });
      await expect(workspaceLink).toBeVisible();
      await workspaceLink.click();
      await expect(page).toHaveURL(new RegExp(`${section.path}$`));
      await waitForUiSettled(page);
      await expect(unsubscribe.first()).toBeVisible();
    },
  );
});

test("已订阅用户取消后更新详情控件与工作区列表", async ({
  sectionRun,
  page,
  memberSection: section,
  isolatedWorker,
}, testInfo) => {
  await sectionRun(
    {
      writes: [
        { action: "unsubscribe", userId: section.userId, subscribedIds: [] },
      ],
      calendar: {
        userId: section.userId,
        messages: [{ type: "user", userId: section.userId }],
      },
    },
    async () => {
      const db = isolatedWorker.database.owner;
      await db.userSectionSubscription.create({
        data: { userId: section.userId, sectionId: section.id },
      });
      await gotoAndWaitForReady(page, "/workspace/subscriptions");
      const workspaceLink = page
        .getByTestId("subscription-course-link")
        .and(page.locator(`a[href="${section.path}"]`))
        .filter({ visible: true });
      await expect(workspaceLink).toBeVisible();
      await workspaceLink.click();
      await expect(page).toHaveURL(new RegExp(`${section.path}$`));
      await waitForUiSettled(page);
      const subscribe = page.getByRole("button", { name: subscribeName });
      const unsubscribe = page.getByRole("button", { name: unsubscribeName });
      await expect(unsubscribe.first()).toBeVisible();
      await expect(subscribe).toHaveCount(0);
      await unsubscribe.first().click();
      await expect(subscribe.first()).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(() => getUserSubscribedSectionIds(db, section.userId))
        .toEqual([]);
      await captureStepScreenshot(page, testInfo, "section/unsubscribed");
      await gotoAndWaitForReady(page, "/workspace/subscriptions");
      await expect(workspaceLink).toHaveCount(0);
    },
  );
});
