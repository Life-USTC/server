import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

test("calendar.subscription-badges", async ({ page }, testInfo) => {
  for (const locale of ["zh-CN", "en-US"]) {
    const url = `/workspace/calendar?calendarView=week&calendarWeek=${DEV_SEED_ANCHOR.date}`;
    await signInAsDebugUser(page, url);
    await ensureSeedSectionSubscription(page);
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: locale.toLowerCase(), url: page.url() },
      ]);
    const endpoint = `/api/workspace/subscriptions/${DEV_SEED.section.jwId}`;
    const subscriptionsResponse = await page.request.get(
      "/api/workspace/subscriptions/current",
    );
    expect(subscriptionsResponse.ok()).toBe(true);
    const subscriptions = await subscriptionsResponse.json();
    const original = subscriptions.subscription.sections.find(
      (section: { jwId: number }) => section.jwId === DEV_SEED.section.jwId,
    );
    expect(original).toBeDefined();

    const originalTitles = new Map<boolean, string>();
    try {
      for (const [kind, label] of [
        ["regular", undefined],
        ["teaching_assistant", locale === "zh-CN" ? "助教" : "TA"],
        ["auditor", locale === "zh-CN" ? "旁听" : "Auditor"],
      ] as const) {
        const response = await page.request.patch(endpoint, {
          data: { kind },
        });
        expect(response.status()).toBe(200);
        for (const mobile of [false, true]) {
          await page.setViewportSize(
            mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
          );
          await gotoAndWaitForReady(page, url);
          const calendar = page.getByTestId(
            mobile ? "calendar-agenda" : "workspace-calendar-grid",
          );
          const course = calendar
            .locator(`a[href="/catalog/sections/${DEV_SEED.section.jwId}"]`)
            .first();
          await expect(course).toBeVisible();
          const title = await course
            .locator('[data-slot="item-title"]')
            .innerText();
          expect(title.trim()).not.toBe("");
          if (kind === "regular") originalTitles.set(mobile, title);
          else expect(title).toBe(originalTitles.get(mobile));
          const badge = course.getByTestId("calendar-subscription-badge");
          if (label) {
            await expect(badge).toBeVisible();
            await expect(badge).toHaveText(label);
            const courseBox = await course.boundingBox();
            const badgeBox = await badge.boundingBox();
            expect(courseBox).not.toBeNull();
            expect(badgeBox).not.toBeNull();
            if (!courseBox || !badgeBox)
              throw new Error("Missing calendar card bounds");
            expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(
              courseBox.x + courseBox.width,
            );
            expect(badgeBox.y).toBeLessThan(courseBox.y + 4);
          } else {
            await expect(badge).toHaveCount(0);
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          if (kind === "teaching_assistant") {
            await captureStepScreenshot(
              page,
              testInfo,
              `calendar/badge-${mobile ? "mobile" : "desktop"}`,
            );
          }
        }
      }
    } finally {
      const response = await page.request.patch(endpoint, {
        data: { kind: original.kind },
      });
      expect(response.status()).toBe(200);
    }
  }
});
