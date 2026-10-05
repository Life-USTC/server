import { expect } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

async function createFixture(owner: TestPrismaClient) {
  const marker = crypto.randomUUID();
  const base = 1_500_000_000 + Math.floor(Math.random() * 100_000_000);
  return owner.$transaction(async (db) => {
    const owner = await db.user.create({
      data: {
        name: "Numeric table reader",
        username: "numericreader",
        email: `${marker}@example.test`,
      },
    });
    const organizer = await db.youngOrganizer.create({
      data: { name: "Alignment activity organizer", normalizedName: marker },
    });
    const event = await db.youngEvent.create({
      data: {
        youngId: marker,
        name: "Alignment capacity activity",
        organizerId: organizer.id,
        organizer: organizer.name,
        isActive: true,
        capacity: 123,
        appliedCount: 7,
        startAt: new Date("2035-09-15T10:00:00+08:00"),
        endAt: new Date("2035-09-15T12:00:00+08:00"),
        applyStartAt: new Date("2035-09-14T08:00:00+08:00"),
        applyEndAt: new Date("2035-09-14T12:00:00+08:00"),
        rawJson: {},
      },
    });
    await db.upload.create({
      data: {
        userId: owner.id,
        key: marker,
        filename: "alignment-report.txt",
        size: 1234,
        contentType: "text/plain",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
    const semester = await db.semester.create({
      data: { jwId: base + 3, code: marker, nameCn: "2026年秋季学期" },
    });
    const course = await db.course.create({
      data: {
        jwId: base,
        code: "NUMERIC-POLICY",
        nameCn: "数字列对齐课程",
        nameEn: "Numeric alignment course",
      },
    });
    const section = await db.section.create({
      data: {
        jwId: base + 1,
        code: "NUMERIC-POLICY-01",
        courseId: course.id,
        semesterId: semester.id,
      },
    });
    await db.exam.create({
      data: {
        jwId: base + 2,
        sectionId: section.id,
        examDate: new Date("2035-09-15T00:00:00Z"),
        startTime: 900,
        endTime: 1100,
        examTakeCount: 47,
        examMode: "Written",
      },
    });
    return { owner, organizer, event, course, section };
  });
}

for (const [domain, names] of [
  ["Young", ["capacity", "organizer-counts"]],
  ["Upload", ["upload-bytes"]],
  ["Exam", ["exam-count"]],
] as const) {
  test(
    `ui.numeric-measure-table-alignment ${domain}`,
    { tag: `@${domain}/Web` },
    async ({ page, baseURL, isolatedWorker, preferenceFlow }, testInfo) => {
      if (!baseURL) throw new Error("Missing Playwright baseURL");
      const f = await preferenceFlow.prepare(() =>
        createFixture(isolatedWorker.database.owner),
      );
      await preferenceFlow.run(async () => {
        await page
          .context()
          .addCookies([
            (await isolatedWorker.createSession(f.owner.id)).cookie,
            { name: "NEXT_LOCALE", value: "en-us", url: baseURL },
          ]);
        await page.setViewportSize({ width: 1280, height: 900 });
        for (const item of [
          {
            name: "capacity",
            path: "/catalog/young-events?search=Alignment%20capacity",
            table: "main table:visible",
            numeric: [3],
          },
          {
            name: "organizer-counts",
            path: "/catalog/young-events/organizers?search=Alignment%20activity",
            table: "main table:visible",
            numeric: [1, 2, 3],
          },
          {
            name: "upload-bytes",
            path: "/workspace/uploads",
            table: "main table:visible",
            numeric: [1],
          },
          {
            name: "exam-count",
            path: `/catalog/sections/${f.section.jwId}`,
            table: '[data-testid="section-exams-list"]',
            numeric: [5],
          },
        ]) {
          if (!names.some((name) => name === item.name)) continue;
          await gotoAndWaitForReady(page, item.path);
          const table = page.locator(item.table);
          await expect(table).toHaveCount(1);
          await expect(table.locator("tbody tr")).toHaveCount(1);
          await table.scrollIntoViewIfNeeded();
          await table.screenshot({
            path: testInfo.outputPath(`numeric-${item.name}.png`),
          });
          const measurements = await table.evaluate((element, indices) => {
            const headers = element.querySelectorAll("thead th");
            const cells = element.querySelectorAll("tbody tr:first-child td");
            function rightEdge(element: Element) {
              const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
              );
              const edges: number[] = [];
              while (walker.nextNode()) {
                const text = walker.currentNode.textContent ?? "";
                const start = text.search(/\S/);
                if (start < 0) continue;
                const range = document.createRange();
                range.setStart(walker.currentNode, start);
                range.setEnd(walker.currentNode, text.trimEnd().length);
                for (const box of range.getClientRects())
                  if (box.width > 0 && box.height > 0) edges.push(box.right);
              }
              if (!edges.length)
                throw new Error("Expected numeric column text");
              return Math.max(...edges);
            }
            return indices.map((index) => ({
              label: headers[index].textContent?.trim(),
              text: cells[index].textContent?.trim(),
              headerAlign: getComputedStyle(headers[index]).textAlign,
              cellAlign: getComputedStyle(cells[index]).textAlign,
              difference: Math.abs(
                rightEdge(headers[index]) - rightEdge(cells[index]),
              ),
            }));
          }, item.numeric);
          for (const column of measurements) {
            expect
              .soft(
                column.text,
                `${item.name} ${column.label}: real numeric value`,
              )
              .toMatch(/\d/);
            expect
              .soft(column.headerAlign, `${item.name} ${column.label}: header`)
              .toBe("right");
            expect
              .soft(column.cellAlign, `${item.name} ${column.label}: cell`)
              .toBe("right");
            expect
              .soft(
                column.difference,
                `${item.name} ${column.label}: text edges`,
              )
              .toBeLessThanOrEqual(1);
          }
        }
      });
    },
  );
}
