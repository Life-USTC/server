import { expect } from "@playwright/test";
import { sectionViewerPath } from "../../../../../../src/lib/navigation/internal-routes";
import { createHomeworkAcademic } from "../../../../utils/homework-state";
import { test } from "../../../../utils/personal-preferences-fixture";

for (const mode of ["delayed", "failed", "suspended", "anonymous"] as const) {
  test(`section homework personal status is gated for ${mode} viewer`, {
    tag: "@Homework/Web",
  }, async ({ page, account, isolatedWorker, preferenceFlow }) => {
    const db = isolatedWorker.database.owner;
    const academic = await preferenceFlow.prepare(async () => {
      const semester = await db.semester.create({
        data: {
          jwId: 987654,
          code: "421",
          nameCn: "2026年春季学期",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      const academic = await createHomeworkAcademic(
        db,
        account.id,
        semester.id,
      );
      const homework = await db.homework.create({
        data: {
          sectionId: academic.section.id,
          createdById: account.id,
          title: "Private completion homework",
          submissionDueAt: new Date("2020-01-01"),
        },
      });
      await db.homeworkCompletion.create({
        data: {
          userId: account.id,
          homeworkId: homework.id,
          completedAt: new Date(),
        },
      });
      if (mode === "suspended")
        await db.userSuspension.create({
          data: { userId: account.id, reason: "Isolated read-only viewer" },
        });
      return { ...academic, homework };
    });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    preferenceFlow.onClosing(release);
    await preferenceFlow.run(async () => {
      if (mode === "anonymous") await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      if (mode === "delayed" || mode === "failed")
        await preferenceFlow.route(
          page,
          (url) => url.pathname === sectionViewerPath(academic.section.jwId),
          async (route) => {
            if (mode === "failed")
              return route.fulfill({
                status: 503,
                body: "Isolated unavailable personal projection",
              });
            await gate;
            await route.fallback();
          },
        );
      // Delayed and failed projection cases intentionally keep loading/error UI.
      // Global "fully settled" helpers would wait on the state under test.
      await page.goto(`/catalog/sections/${academic.section.jwId}#homework`, {
        waitUntil: "domcontentloaded",
      });
      await expect(
        page.getByRole("heading", { name: "Homework", exact: true }),
      ).toBeVisible();
      if (mode === "failed")
        await expect(
          page.getByRole("alert").filter({ hasText: "retry" }).first(),
        ).toBeVisible();
      const list = page.getByTestId("section-homeworks-list");
      const status = list.getByRole("group", {
        name: "My status",
        exact: true,
      });
      if (mode !== "suspended")
        await expect(
          page.getByRole("group", { name: "My status", exact: true }),
        ).toHaveCount(0);
      if (mode === "delayed") release();
      if (mode === "delayed" || mode === "suspended") {
        await expect(
          status
            .filter({ visible: true })
            .getByText("Completed", { exact: true }),
        ).toBeVisible();
        if (mode === "suspended") {
          await status
            .filter({ visible: true })
            .getByRole("button", { name: "View details", exact: true })
            .click();
          await expect(
            page.getByRole("dialog").getByRole("button", {
              name: /Mark as incomplete|Mark as complete/,
            }),
          ).toHaveCount(0);
          await page.keyboard.press("Escape");
        }
      }
      expect(
        await db.homeworkCompletion.count({
          where: { homeworkId: academic.homework.id, userId: account.id },
        }),
      ).toBe(1);
    });
  });
}
