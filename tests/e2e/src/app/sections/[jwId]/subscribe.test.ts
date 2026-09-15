/**
 * E2E: /catalog/sections/[jwId] — Section subscription / follow flows
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { getCurrentSessionUser } from "../../../../utils/e2e-db";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { SECTION_URL } from "./_helpers";

test.describe("/catalog/sections/[jwId] 班级详情页", () => {
  test("关注按钮使用订阅用语而非选课用语", async ({ page }) => {
    // section.yml subscription-not-enrollment rule:
    // Subscribe button must say "subscribe/follow", not "enroll".
    // Disclaimer text MAY reference enrollment to contrast subscription vs enrollment.
    await gotoAndWaitForReady(page, SECTION_URL);

    // There must be NO button that says "enroll" as a positive action
    await expect(
      page.getByRole("button", { name: /enroll|报名选课/i }),
    ).toHaveCount(0);

    // The subscription button uses subscribe/follow language
    const subscribeBtn = page
      .getByRole("button", {
        name: /订阅教学班|Subscribe to section/i,
      })
      .or(
        page.getByRole("button", {
          name: /取消订阅|Unsubscribe from section/i,
        }),
      )
      .first();
    await expect(subscribeBtn).toBeVisible();
  });

  test("已退役班级保留历史详情与日历但禁止新增关注", async ({ page }) => {
    test.setTimeout(60_000);
    const previous = await withE2ePrisma((prisma) =>
      prisma.section.findUniqueOrThrow({
        where: { jwId: DEV_SEED.section.jwId },
        select: { retiredAt: true },
      }),
    );

    await withE2ePrisma((prisma) =>
      prisma.section.update({
        where: { jwId: DEV_SEED.section.jwId },
        data: { retiredAt: new Date("2026-01-01T00:00:00.000Z") },
      }),
    );

    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoAndWaitForReady(page, `${SECTION_URL}?subscribe=1`);

      await expect(
        page.getByText(/历史班级|Historical section/i).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /订阅教学班|Subscribe to section/i,
        }),
      ).toHaveCount(0);
      await expect(
        page
          .getByTestId("detail-pinned-summary")
          .getByRole("button", { name: /添加到日历|Add to calendar/i }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } finally {
      await withE2ePrisma((prisma) =>
        prisma.section.update({
          where: { jwId: DEV_SEED.section.jwId },
          data: { retiredAt: previous.retiredAt },
        }),
      );
    }
  });

  test("已订阅用户仍可取消订阅已退役教学班", async ({ page }) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, SECTION_URL);
    const sessionUser = await getCurrentSessionUser(page);
    const previous = await withE2ePrisma(async (prisma) => {
      const [section, user] = await Promise.all([
        prisma.section.findUniqueOrThrow({
          where: { jwId: DEV_SEED.section.jwId },
          select: { id: true, retiredAt: true },
        }),
        prisma.user.findUniqueOrThrow({
          where: { id: sessionUser.id },
          select: {
            sectionSubscriptions: {
              orderBy: { sectionId: "asc" },
              select: { sectionId: true },
            },
          },
        }),
      ]);
      return {
        section,
        subscribedSectionIds: user.sectionSubscriptions.map(
          (subscription) => subscription.sectionId,
        ),
      };
    });

    await withE2ePrisma((prisma) =>
      prisma.$transaction([
        prisma.section.update({
          where: { id: previous.section.id },
          data: { retiredAt: new Date("2026-01-01T00:00:00.000Z") },
        }),
        prisma.user.update({
          where: { id: sessionUser.id },
          data: {
            sectionSubscriptions: {
              deleteMany: {},
              create: [
                ...new Set([
                  ...previous.subscribedSectionIds,
                  previous.section.id,
                ]),
              ].map((sectionId) => ({ sectionId })),
            },
          },
        }),
      ]),
    );

    try {
      await gotoAndWaitForReady(page, SECTION_URL);

      await expect(
        page.getByText(/历史班级|Historical section/i).first(),
      ).toBeVisible();
      const unsubscribe = page.getByRole("button", {
        name: /取消订阅|Unsubscribe from section/i,
      });
      await expect(unsubscribe.first()).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /订阅教学班|Subscribe to section/i,
        }),
      ).toHaveCount(0);

      await unsubscribe.first().click();
      await expect
        .poll(() =>
          withE2ePrisma(async (prisma) => {
            const user = await prisma.user.findUniqueOrThrow({
              where: { id: sessionUser.id },
              select: {
                sectionSubscriptions: {
                  where: { sectionId: previous.section.id },
                  select: { sectionId: true },
                },
              },
            });
            return user.sectionSubscriptions.length;
          }),
        )
        .toBe(0);
      await expect(unsubscribe).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: /订阅教学班|Subscribe to section/i,
        }),
      ).toHaveCount(0);
    } finally {
      await withE2ePrisma((prisma) =>
        prisma.$transaction([
          prisma.section.update({
            where: { id: previous.section.id },
            data: { retiredAt: previous.section.retiredAt },
          }),
          prisma.user.update({
            where: { id: sessionUser.id },
            data: {
              sectionSubscriptions: {
                deleteMany: {},
                create: previous.subscribedSectionIds.map((sectionId) => ({
                  sectionId,
                })),
              },
            },
          }),
        ]),
      );
    }
  });

  test("关注弹窗显示非选课声明", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    const subscribeButton = page
      .getByRole("button", { name: /订阅教学班|Subscribe to section/i })
      .first();
    await expect(subscribeButton).toBeVisible();
    await subscribeButton.click();

    const subscribeDialog = page
      .getByRole("dialog")
      .or(page.getByRole("alertdialog"))
      .first();
    await expect(subscribeDialog).toBeVisible();
    await expect(
      subscribeDialog
        .getByText(/非官方|非正式|not.*official|not.*enrollment/i)
        .first(),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "section/disclaimer");
  });

  test("未登录时关注弹出登录对话框", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, SECTION_URL);

    const subscribeButton = page
      .getByRole("button", { name: /订阅教学班|Subscribe to section/i })
      .first();
    await expect(subscribeButton).toBeVisible();

    await subscribeButton.click();
    const loginDialog = page
      .getByRole("dialog")
      .or(page.getByRole("alertdialog"))
      .first();
    await expect(loginDialog).toBeVisible();
    await captureStepScreenshot(
      page,
      testInfo,
      "section/subscribe-login-required",
    );
  });

  test("已登录用户可订阅与取消订阅", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, SECTION_URL);

    const subscribe = page.getByRole("button", {
      name: /订阅教学班|Subscribe to section/i,
    });
    const unsubscribe = page.getByRole("button", {
      name: /取消订阅|Unsubscribe from section/i,
    });

    await expect(subscribe.or(unsubscribe).first()).toBeVisible();

    if ((await subscribe.count()) > 0) {
      await subscribe.first().click();
      const subscribeDialog = page.getByRole("dialog").first();
      await expect(subscribeDialog).toBeVisible();
      await expect(
        subscribeDialog
          .getByText(/非官方|非正式|not.*official|not.*enrollment/i)
          .first(),
      ).toBeVisible();
      await subscribeDialog
        .getByRole("button", { name: /订阅教学班|Subscribe to section/i })
        .click();
      await expect(unsubscribe.first()).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press("Escape");
      await expect(subscribeDialog).toBeHidden({ timeout: 5_000 });
      await captureStepScreenshot(page, testInfo, "section/subscribed");
    }

    if ((await unsubscribe.count()) > 0) {
      await unsubscribe.first().click();
      await expect(subscribe.first()).toBeVisible({ timeout: 15_000 });
      await captureStepScreenshot(page, testInfo, "section/unsubscribed");
    }
  });
});
