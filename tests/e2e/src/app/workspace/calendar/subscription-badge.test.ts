import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import {
  prepareSemesterObservation,
  test,
} from "../../account-policy/semester-presentation-fixture";

for (const locale of ["zh-CN", "en-US"]) {
  test(`calendar.subscription-badges: ${locale}`, async ({
    page,
    calendar: fixture,
    isolatedWorker,
    calendarProtocolRun,
  }) => {
    // Each locale owns three subscription kinds × four viewport/view combinations.
    // Each case loads and hydrates the calendar; keep individual waits unchanged.
    test.setTimeout(60_000);
    await calendarProtocolRun(async (io) => {
      await page.context().clearCookies();
      const observation = await prepareSemesterObservation(
        page,
        isolatedWorker,
        io,
        fixture.users[0].id,
        Array.from({ length: 3 }, () => ({
          type: "user",
          userId: fixture.users[0].id,
        })),
      );
      await page.context().addCookies([
        {
          name: "NEXT_LOCALE",
          value: locale.toLowerCase(),
          url: isolatedWorker.origin,
        },
      ]);
      const endpoint = `/api/workspace/subscriptions/${fixture.section.jwId}`;
      const originalTitles = new Map<string, string>();
      for (const [kind, label] of [
        ["regular", undefined],
        ["teaching_assistant", locale === "zh-CN" ? "助教" : "TA"],
        ["auditor", locale === "zh-CN" ? "旁听" : "Auditor"],
      ] as const) {
        const response = await page.request.patch(endpoint, {
          data: { kind },
        });
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({
          sectionJwId: fixture.section.jwId,
          kind,
        });
        expect(
          await isolatedWorker.database.owner.userSectionSubscription.findUnique(
            {
              where: {
                userId_sectionId: {
                  userId: fixture.users[0].id,
                  sectionId: fixture.section.id,
                },
              },
              select: { kind: true },
            },
          ),
        ).toEqual({ kind });
        for (const [mobile, view] of [
          [false, "week"],
          [true, "week"],
          [false, "day"],
          [true, "day"],
        ] as const) {
          const key = `${mobile}-${view}`;
          await page.setViewportSize(
            mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
          );
          await gotoAndWaitForReady(page, fixture.academicUrl(view));
          const calendar = page.getByTestId(
            mobile || view === "day"
              ? "calendar-agenda"
              : "workspace-calendar-grid",
          );
          const course = calendar
            .locator(`a[href="/catalog/sections/${fixture.section.jwId}"]`)
            .first();
          await expect(course).toBeVisible();
          const title = await course
            .locator('[data-slot="item-title"]')
            .innerText();
          expect(title.trim()).not.toBe("");
          if (kind === "regular") originalTitles.set(key, title);
          else expect(title).toBe(originalTitles.get(key));
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
        }
      }
      return observation.checks({
        feedTokenCreated: true,
        requests: [
          [
            "PATCH",
            `/api/workspace/subscriptions/${fixture.section.jwId}`,
            [200, 200, 200],
          ],
        ],
        subscriptionKind: { sectionId: fixture.section.id, kind: "auditor" },
      });
    });
  });
}
