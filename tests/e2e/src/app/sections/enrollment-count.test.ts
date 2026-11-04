import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

test("ordinary section enrollment preserves zero rendering and SQL null filtering", {
  tag: "@Section/Web",
}, async ({ page, isolatedWorker, preferenceFlow }) => {
  await preferenceFlow.run(async () => {
    const db = isolatedWorker.database.owner;
    const course = await db.course.create({
      data: {
        jwId: 1600000500,
        code: "ENROLLMENT-CONTROL",
        nameCn: "Enrollment control",
      },
    });
    await db.section.createMany({
      data: [
        {
          jwId: 1600000501,
          code: "ENROLLMENT-ZERO",
          courseId: course.id,
          stdCount: 0,
        },
        {
          jwId: 1600000502,
          code: "ENROLLMENT-UNKNOWN",
          courseId: course.id,
          stdCount: null,
        },
      ],
    });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await gotoAndWaitForReady(page, "/catalog/sections?search=ENROLLMENT");
      await expect(page.getByTestId("demo-notice")).toHaveCount(0);
      const rows = page.locator(
        '#main-content a[href^="/catalog/sections/"]:visible',
      );
      await expect(rows).toHaveCount(2);
      const displayedRows =
        width === 1280
          ? page.locator("#main-content tbody tr:visible").filter({
              has: page.locator('a[href^="/catalog/sections/"]'),
            })
          : rows;
      // Ordinary rendering remains the pre-existing fallback for missing counts.
      for (const row of await displayedRows.all())
        await expect(row).toContainText(/0\s*\/\s*-/);
      await gotoAndWaitForReady(
        page,
        "/catalog/sections?search=ENROLLMENT&stdCount=0",
      );
      await expect(rows).toHaveCount(1);
      await expect(rows).toHaveAttribute(
        "href",
        "/catalog/sections/1600000501",
      );
      await expect(displayedRows).toContainText(/0\s*\/\s*-/);
    }
    expect(
      (
        await db.section.findMany({
          orderBy: { jwId: "asc" },
          select: { stdCount: true },
        })
      ).map((row) => row.stdCount),
    ).toEqual([0, null]);
  });
});
