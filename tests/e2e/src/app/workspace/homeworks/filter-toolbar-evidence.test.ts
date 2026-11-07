import { expect } from "@playwright/test";
import { test } from "../../../../utils/homework-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { absoluteTestUrl } from "../../../../utils/request-url";
import { expectTaskToolbarDraftContract } from "../../../../utils/workspace-task-toolbar-contract";

test("homeworks.filter-toolbar-evidence", { tag: "@Homework/Web" }, async ({
  page,
  baseURL,
  homeworkRun,
  academicDb,
  academic,
  homeworks,
}) => {
  await homeworkRun(
    async () => {
      await academicDb(async (db) => {
        await db.course.update({
          where: { id: academic.course.id },
          data: {
            nameCn: "线性代数",
            nameEn: "Linear Algebra",
            code: "MATH1001",
          },
        });
        await db.section.update({
          where: { id: academic.section.id },
          data: { code: "MATH1001.01" },
        });
        for (const [index, item] of homeworks.entries())
          await db.homework.update({
            where: { id: item.id },
            data: {
              title:
                index === 0 ? "Matrix problem set" : "Team research report",
            },
          });
      });
      for (const locale of ["zh-cn", "en-us"])
        for (const width of [390, 1280]) {
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: locale,
              url: absoluteTestUrl("/", baseURL),
            },
          ]);
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(page, "/workspace/homeworks");
          await expect(
            page.getByTestId(
              `workspace-homeworks-${width === 390 ? "cards" : "list"}`,
            ),
          ).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (process.env.FILTER_EVIDENCE_DIR)
            await page.screenshot({
              path: `${process.env.FILTER_EVIDENCE_DIR}/homeworks-${locale}-${width}.png`,
              fullPage: true,
              animations: "disabled",
            });
        }
      await expectTaskToolbarDraftContract(
        page,
        "homeworks",
        "Matrix problem set",
      );
    },
    { calendarMessages: [] },
  );
});
