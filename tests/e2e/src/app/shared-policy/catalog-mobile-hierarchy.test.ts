import { expect, type Locator, type Page } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

async function createFixture(db: TestPrismaClient) {
  const base = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);
  return db.$transaction(async (tx) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const education = await tx.educationLevel.create({
      data: { nameCn: `层次${suffix}`, nameEn: `Level ${suffix}` },
    });
    const category = await tx.courseCategory.create({
      data: { nameCn: `类别${suffix}`, nameEn: `Category ${suffix}` },
    });
    const classType = await tx.classType.create({
      data: { nameCn: `类型${suffix}`, nameEn: `Class type ${suffix}` },
    });
    const department = await tx.department.create({
      data: {
        code: suffix,
        nameCn: `学院${suffix}`,
        nameEn: `Department ${suffix}`,
      },
    });
    const title = await tx.teacherTitle.create({
      data: {
        jwId: base + 3,
        code: suffix,
        nameCn: `职称${suffix}`,
        nameEn: `Title ${suffix}`,
      },
    });
    const semester = await tx.semester.create({
      data: { jwId: base + 4, code: suffix, nameCn: "2026-2027学年第一学期" },
    });
    const campus = await tx.campus.create({
      data: {
        jwId: base + 5,
        nameCn: `校区${suffix}`,
        nameEn: `Campus ${suffix}`,
      },
    });
    const user = await tx.user.create({
      data: { name: "Hierarchy author", email: `${suffix}@example.test` },
    });
    const course = await tx.course.create({
      data: {
        jwId: base,
        code: `HIER-${suffix}`,
        nameCn: "移动阅读层次测试课程",
        nameEn: "Mobile reading hierarchy course",
        educationLevelId: education.id,
        categoryId: category.id,
        classTypeId: classType.id,
      },
    });
    const teacher = await tx.teacher.create({
      data: {
        jwId: base + 1,
        code: `HIER-T-${suffix}`,
        nameCn: "移动阅读层次测试教师",
        nameEn: "Mobile reading hierarchy teacher",
        departmentId: department.id,
        teacherTitleId: title.id,
        email: `teacher-${suffix}@example.test`,
      },
    });
    const section = await tx.section.create({
      data: {
        jwId: base + 2,
        code: `HIER-S-${suffix}`,
        courseId: course.id,
        teachers: { connect: { id: teacher.id } },
        semesterId: semester.id,
        campusId: campus.id,
        credits: 4,
        remark: `Secondary section facts ${suffix}`,
      },
    });
    for (const target of [
      { courseId: course.id },
      { teacherId: teacher.id },
      { sectionId: section.id },
    ]) {
      await tx.description.create({
        data: {
          ...target,
          content: "Readable introduction for the catalog hierarchy.",
          lastEditedById: user.id,
        },
      });
    }
    return {
      education,
      category,
      classType,
      department,
      title,
      semester,
      campus,
      user,
      course,
      teacher,
      section,
    };
  });
}

function required(value: string | null) {
  if (value === null) throw new Error("Fixture field must be populated");
  return value;
}

test(
  "ui.catalog-table-column-alignment",
  { tag: "@Catalog/Web" },
  async ({ preferenceFlow, isolatedWorker, page, baseURL }, testInfo) => {
    await preferenceFlow.run(async () => {
      if (!baseURL) throw new Error("Missing Playwright baseURL");
      const fixture = await createFixture(isolatedWorker.database.owner);
      await isolatedWorker.database.owner.$transaction(async (db) => {
        await db.course.update({
          where: { id: fixture.course.id },
          data: { code: "ALIGN-COURSE" },
        });
        await db.teacher.update({
          where: { id: fixture.teacher.id },
          data: { code: "ALIGN-TEACHER", email: "alignment@example.test" },
        });
        await db.section.update({
          where: { id: fixture.section.id },
          data: {
            code: "ALIGN-SECTION",
            stdCount: 12,
            limitCount: 48,
            credits: 4,
          },
        });
        await db.educationLevel.update({
          where: { id: fixture.education.id },
          data: { nameCn: "对齐验收本科", nameEn: "Alignment level" },
        });
        await db.courseCategory.update({
          where: { id: fixture.category.id },
          data: { nameCn: "对齐验收基础课程", nameEn: "Alignment category" },
        });
        await db.classType.update({
          where: { id: fixture.classType.id },
          data: { nameCn: "对齐验收必修", nameEn: "Alignment class type" },
        });
        await db.department.update({
          where: { id: fixture.department.id },
          data: { nameCn: "测试学院", nameEn: "Test department" },
        });
        await db.teacherTitle.update({
          where: { id: fixture.title.id },
          data: { nameCn: "对齐验收教授", nameEn: "Alignment professor" },
        });
        await db.campus.update({
          where: { id: fixture.campus.id },
          data: { nameCn: "测试校区", nameEn: "Test campus" },
        });
      });
      await page.context().addCookies([
        {
          name: "NEXT_LOCALE",
          value: "en-us",
          url: baseURL,
        },
      ]);
      await page.setViewportSize({ width: 1280, height: 844 });
      for (const item of [
        {
          name: "courses",
          path: "/catalog/courses?search=ALIGN-COURSE",
          selector: "table",
          numeric: [],
        },
        {
          name: "teachers",
          path: "/catalog/teachers?search=ALIGN-TEACHER",
          selector: "table",
          numeric: [5],
        },
        {
          name: "sections",
          path: "/catalog/sections?courseCode=ALIGN-COURSE",
          selector: "table",
          numeric: [4, 5],
        },
        {
          name: "course-history",
          path: `/catalog/courses/${fixture.course.jwId}`,
          selector: "#sections table",
          numeric: [3],
        },
        {
          name: "teacher-history",
          path: `/catalog/teachers/${fixture.teacher.id}`,
          selector: "#sections table",
          numeric: [2],
        },
      ]) {
        await gotoAndWaitForReady(page, item.path);
        const table = page.locator(item.selector).filter({ visible: true });
        await expect(table).toHaveCount(1);
        await table.scrollIntoViewIfNeeded();
        await table.screenshot({
          path: testInfo.outputPath(`alignment-${item.name}.png`),
        });
        const columns = await table.evaluate((element) => {
          const headers = Array.from(element.querySelectorAll("thead th"));
          const cells = Array.from(
            element.querySelectorAll("tbody tr:first-child td"),
          );
          function textEdges(node: Element) {
            const walker = document.createTreeWalker(
              node,
              NodeFilter.SHOW_TEXT,
            );
            const boxes: DOMRect[] = [];
            while (walker.nextNode()) {
              const text = walker.currentNode.textContent ?? "";
              const start = text.search(/\S/);
              if (start < 0) continue;
              const range = document.createRange();
              range.setStart(walker.currentNode, start);
              range.setEnd(walker.currentNode, text.trimEnd().length);
              boxes.push(
                ...Array.from(range.getClientRects()).filter(
                  (box) => box.width > 0 && box.height > 0,
                ),
              );
            }
            if (!boxes.length) throw new Error("Missing table text");
            return {
              left: Math.min(...boxes.map((box) => box.left)),
              right: Math.max(...boxes.map((box) => box.right)),
            };
          }
          return headers.map((header, index) => ({
            label: header.textContent?.trim(),
            header: textEdges(header),
            cell: textEdges(cells[index]),
          }));
        });
        expect(columns.length).toBeGreaterThan(0);
        for (const [index, column] of columns.entries()) {
          const edge = item.numeric.includes(index) ? "right" : "left";
          expect
            .soft(
              Math.abs(column.header[edge] - column.cell[edge]),
              `${item.name}: ${column.label} ${edge} edge`,
            )
            .toBeLessThanOrEqual(1);
        }
      }
    });
  },
);

test("ui.detail-two-column-stream-1", { tag: "@Catalog/Web" }, async ({
  preferenceFlow,
  isolatedWorker,
  page,
}) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const item of [
        {
          path: `/catalog/courses/${fixture.course.jwId}`,
          sections: ["introduction", "sections", "comments"],
        },
        {
          path: `/catalog/teachers/${fixture.teacher.id}`,
          sections: ["introduction", "sections", "comments"],
        },
        {
          path: `/catalog/sections/${fixture.section.jwId}`,
          sections: [
            "introduction",
            "calendar",
            "exams",
            "homework",
            "comments",
          ],
        },
      ]) {
        await gotoAndWaitForReady(page, item.path);
        const stream = page.locator("[data-detail-reading-stream]");
        await expect(stream).toHaveCount(1);
        for (const id of item.sections) {
          const section = stream.locator(`:scope > section#${id}`);
          await expect(section).toBeVisible();
          await section.scrollIntoViewIfNeeded();
          await expect(page).toHaveURL(new RegExp(`${item.path}$`));
          for (const other of item.sections)
            await expect(
              stream.locator(`:scope > section#${other}`),
            ).toBeVisible();
        }
        const sections = await stream
          .locator(":scope > section")
          .evaluateAll((elements) => elements.map((element) => element.id));
        expect(sections).toEqual(item.sections);
        const links = await page
          .getByRole("main")
          .locator("a[href]")
          .evaluateAll((anchors) =>
            anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
          );
        for (const href of links) {
          const url = new URL(href, `http://localhost${item.path}`);
          if (url.pathname === item.path)
            expect(url.searchParams.has("tab")).toBe(false);
          expect(
            item.sections.some((id) => url.pathname === `${item.path}/${id}`),
          ).toBe(false);
        }
      }
    }
  });
});

test("ui.detail-two-column-stream-7", { tag: "@Catalog/Web" }, async ({
  preferenceFlow,
  isolatedWorker,
  page,
}) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    await isolatedWorker.database.owner.$transaction((db) =>
      db.description.updateMany({
        where: { lastEditedById: fixture.user.id },
        data: {
          content: `[Jump to discussion](#comments)\n\n${Array.from({ length: 35 }, (_, index) => `Reading paragraph ${index + 1}: public detail context remains in the same continuous reading stream.`).join("\n\n")}`,
        },
      }),
    );
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of [
        `/catalog/courses/${fixture.course.jwId}`,
        `/catalog/teachers/${fixture.teacher.id}`,
        `/catalog/sections/${fixture.section.jwId}`,
      ]) {
        await gotoAndWaitForReady(page, path);
        const link = page
          .locator("#introduction")
          .getByRole("link", { name: "Jump to discussion", exact: true });
        await expect(link).toHaveAttribute("href", "#comments");
        const target = page.locator("#comments");
        await expect(target).toHaveCount(1);
        const before = await target.boundingBox();
        expect(before?.y).toBeGreaterThan(844);
        const scrollOffset = () =>
          target.evaluate((element) => {
            let offset = 0;
            for (
              let ancestor = element.parentElement;
              ancestor;
              ancestor = ancestor.parentElement
            )
              offset += ancestor.scrollTop;
            return offset;
          });
        const initialScroll = await scrollOffset();
        const navigation: string[] = [];
        const observe = (request: import("@playwright/test").Request) => {
          if (
            request.isNavigationRequest() ||
            new URL(request.url()).pathname.endsWith("/__data.json")
          )
            navigation.push(request.url());
        };
        page.on("request", observe);
        await link.click();
        await expect(page).toHaveURL(
          `${new URL(path, page.url()).href}#comments`,
        );
        await expect
          .poll(async () => {
            const bounds = await target.boundingBox();
            return bounds !== null && bounds.y >= 0 && bounds.y < 844;
          })
          .toBe(true);
        expect(await scrollOffset()).toBeGreaterThan(initialScroll);
        expect(navigation).toEqual([]);
        page.off("request", observe);
      }
    }
  });
});

test("ui.detail-hero-4", { tag: "@Catalog/Web" }, async ({
  preferenceFlow,
  isolatedWorker,
  page,
}) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    const courseNames = {
      nameCn: "跨学科科学研究与高等数学方法应用课程".repeat(4),
      nameEn:
        "Interdisciplinary scientific research and advanced mathematical methods "
          .repeat(4)
          .trim(),
    };
    const teacherNames = {
      nameCn: "跨学科科学研究领域教师姓名".repeat(4),
      nameEn: "Professor of interdisciplinary scientific research "
        .repeat(4)
        .trim(),
    };
    await isolatedWorker.database.owner.$transaction(async (db) => {
      await db.course.update({
        where: { id: fixture.course.id },
        data: courseNames,
      });
      await db.teacher.update({
        where: { id: fixture.teacher.id },
        data: teacherNames,
      });
    });
    for (const locale of ["zh-cn", "en-us"]) {
      expect(
        (
          await preferenceFlow.http(() =>
            page.request.post("/api/account/preferences", {
              headers: preferenceFlow.headers,
              data: { locale },
            }),
          )
        ).status(),
      ).toBe(200);
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const item of [
          {
            path: `/catalog/courses/${fixture.course.jwId}`,
            bilingualHeading: true,
            names: courseNames,
            code: fixture.course.code,
            id: fixture.course.id,
            jwId: fixture.course.jwId,
          },
          {
            path: `/catalog/sections/${fixture.section.jwId}`,
            bilingualHeading: false,
            names: courseNames,
            code: fixture.section.code,
            id: fixture.section.id,
            jwId: fixture.section.jwId,
          },
          {
            path: `/catalog/teachers/${fixture.teacher.id}`,
            bilingualHeading: true,
            names: teacherNames,
            code: null,
            id: fixture.teacher.id,
            jwId: fixture.teacher.jwId,
          },
        ]) {
          await gotoAndWaitForReady(page, item.path);
          const title = page.getByRole("heading", { level: 1 });
          await expect(title).toHaveCount(1);
          await expect(title).toHaveText(
            locale === "zh-cn"
              ? item.names.nameCn
              : item.bilingualHeading
                ? `${item.names.nameEn} (${item.names.nameCn})`
                : item.names.nameEn,
          );
          const hero = title.locator("xpath=ancestor::header[1]");
          if (!item.bilingualHeading) {
            await expect(
              hero.getByText(
                locale === "zh-cn" ? "授课班级" : "Teaching section",
                { exact: true },
              ),
            ).toBeVisible();
          }
          if (item.code) {
            const code = hero.getByText(item.code, { exact: true });
            await expect(code).toBeVisible();
            const bounds = await box(code);
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            expect(
              await code.evaluate(
                (element) => element.scrollWidth <= element.clientWidth + 1,
              ),
            ).toBe(true);
          }
          const bounds = await box(title);
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
          expect(
            await title.evaluate(
              (element) => element.scrollWidth <= element.clientWidth + 1,
            ),
          ).toBe(true);
          await expect(
            hero.getByText(String(item.id), { exact: true }),
          ).toHaveCount(0);
          await expect(
            hero.getByText(String(item.jwId), { exact: true }),
          ).toHaveCount(0);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
        }
      }
    }
  });
});

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error("Required catalog region is not visible");
  return result;
}

async function regionBounds(page: Page, selectors: string[]) {
  return page.evaluate(
    (selectors) =>
      selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing catalog region: ${selector}`);
        const { x, y, width, height } = element.getBoundingClientRect();
        if (
          width <= 0 ||
          height <= 0 ||
          getComputedStyle(element).visibility !== "visible"
        )
          throw new Error(`Catalog region is not visible: ${selector}`);
        return { x, y, width, height };
      }),
    selectors,
  );
}

test(
  "ui.layout-principles-3",
  { tag: "@Catalog/Web" },
  async ({ preferenceFlow, isolatedWorker, page }, testInfo) => {
    await preferenceFlow.run(async () => {
      const fixture = await createFixture(isolatedWorker.database.owner);
      for (const locale of ["zh-cn", "en-us"] as const) {
        expect(
          (
            await preferenceFlow.http(() =>
              page.request.post("/api/account/preferences", {
                headers: preferenceFlow.headers,
                data: { locale },
              }),
            )
          ).status(),
        ).toBe(200);
        const cn = locale === "zh-cn";
        for (const item of [
          {
            kind: "course",
            path: `/catalog/courses/${fixture.course.jwId}`,
            identity: [
              cn
                ? fixture.education.nameCn
                : required(fixture.education.nameEn),
              cn ? fixture.category.nameCn : required(fixture.category.nameEn),
            ],
            secondary: cn
              ? fixture.classType.nameCn
              : required(fixture.classType.nameEn),
          },
          {
            kind: "teacher",
            path: `/catalog/teachers/${fixture.teacher.id}`,
            identity: [
              cn
                ? fixture.department.nameCn
                : required(fixture.department.nameEn),
              cn ? fixture.title.nameCn : required(fixture.title.nameEn),
            ],
            secondary: required(fixture.teacher.email),
          },
          {
            kind: "section",
            path: `/catalog/sections/${fixture.section.jwId}`,
            identity: [
              cn ? fixture.teacher.nameCn : required(fixture.teacher.nameEn),
              cn ? fixture.campus.nameCn : required(fixture.campus.nameEn),
              fixture.semester.nameCn,
            ],
            secondary: required(fixture.section.remark),
          },
        ]) {
          await page.setViewportSize({ width: 390, height: 844 });
          await gotoAndWaitForReady(page, item.path);
          await page.screenshot({
            path: testInfo.outputPath(`${item.kind}-${locale}-mobile.png`),
            fullPage: true,
          });
          const identity = page.locator("[data-detail-identity]");
          const reading = page.locator("[data-detail-reading-stream]");
          const secondary = page.locator(
            "[data-detail-scroll-container] aside",
          );
          await expect(identity).toBeVisible();
          await expect(reading.locator("#introduction")).toContainText(
            "Readable introduction",
          );
          for (const value of item.identity)
            await expect(identity).toContainText(value);
          await expect(secondary).toContainText(item.secondary);
          const order = await page.evaluate(() => {
            const hero = document.querySelector("h1");
            const identity = document.querySelector("[data-detail-identity]");
            const reading = document.querySelector(
              "[data-detail-reading-stream]",
            );
            const secondary = document.querySelector(
              "[data-detail-scroll-container] aside",
            );
            if (!hero || !identity || !reading || !secondary)
              throw new Error("Missing catalog region");
            return [
              Boolean(
                hero.compareDocumentPosition(identity) &
                  Node.DOCUMENT_POSITION_FOLLOWING,
              ),
              Boolean(
                identity.compareDocumentPosition(reading) &
                  Node.DOCUMENT_POSITION_FOLLOWING,
              ),
              Boolean(
                reading.compareDocumentPosition(secondary) &
                  Node.DOCUMENT_POSITION_FOLLOWING,
              ),
            ];
          });
          expect(order).toEqual([true, true, true]);
          // Read one layout so streamed content cannot shift later measurements.
          const [hero, identityBounds, readingBounds, secondaryBounds] =
            await regionBounds(page, [
              "h1",
              "[data-detail-identity]",
              "[data-detail-reading-stream]",
              "[data-detail-scroll-container] aside",
            ]);
          expect(hero.y + hero.height).toBeLessThanOrEqual(identityBounds.y);
          expect(identityBounds.y + identityBounds.height).toBeLessThanOrEqual(
            readingBounds.y,
          );
          expect(readingBounds.y + readingBounds.height).toBeLessThanOrEqual(
            secondaryBounds.y,
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          if (item.kind === "section") {
            await expect(page.locator("#teachers")).toHaveCount(1);
            await expect(
              identity.getByRole("link", {
                name: new RegExp(
                  cn
                    ? fixture.teacher.nameCn
                    : required(fixture.teacher.nameEn),
                ),
              }),
            ).toHaveAttribute(
              "href",
              `/catalog/teachers/${fixture.teacher.id}`,
            );
          }
          await page.setViewportSize({ width: 1280, height: 900 });
          // Resizing animates the sidebar width. Compare regions from one layout
          // observation so a transition cannot move the grid between measurements.
          const [desktopReading, desktopIdentity, desktopSecondary] =
            await regionBounds(page, [
              "[data-detail-reading-stream]",
              "[data-detail-identity]",
              "[data-detail-scroll-container] aside",
            ]);
          expect(desktopIdentity.x).toBeGreaterThan(
            desktopReading.x + desktopReading.width,
          );
          expect(desktopSecondary.x).toBe(desktopIdentity.x);
          expect(desktopSecondary.y).toBeGreaterThan(
            desktopIdentity.y + desktopIdentity.height,
          );
          if (locale === "en-us")
            await page.screenshot({
              path: testInfo.outputPath(`${item.kind}-desktop.png`),
              fullPage: true,
            });
        }
      }
    });
  },
);

test(
  "ui.catalog-count-copy",
  { tag: "@Catalog/Web" },
  async ({ preferenceFlow, isolatedWorker, page, baseURL }, testInfo) => {
    await preferenceFlow.run(async () => {
      if (!baseURL) throw new Error("Missing Playwright baseURL");
      const fixtures = [
        await createFixture(isolatedWorker.database.owner),
        await createFixture(isolatedWorker.database.owner),
      ];
      for (const [index, fixture] of fixtures.entries()) {
        await isolatedWorker.database.owner.$transaction(async (db) => {
          await db.course.update({
            where: { id: fixture.course.id },
            data: { code: `COUNT-COURSE-${index}` },
          });
          await db.teacher.update({
            where: { id: fixture.teacher.id },
            data: { code: `COUNT-TEACHER-${index}` },
          });
          await db.section.update({
            where: { id: fixture.section.id },
            data: { code: `COUNT-SECTION-${index}` },
          });
        });
      }
      await page.setViewportSize({ width: 1280, height: 844 });
      for (const locale of ["en-us", "zh-cn"]) {
        await page
          .context()
          .addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
        for (const [route, code, singular, plural, chinese] of [
          ["courses", "COURSE", "course", "courses", "门课程"],
          ["teachers", "TEACHER", "teacher", "teachers", "位教师"],
          ["sections", "SECTION", "section", "sections", "个班级"],
        ] as const) {
          for (const count of [0, 1, 2]) {
            const query = `COUNT-${code}${count === 2 ? "" : count === 1 ? "-0" : "-MISSING"}`;
            await gotoAndWaitForReady(
              page,
              `/catalog/${route}?search=${query}`,
            );
            const summary = page
              .locator('[data-slot="results-summary"]')
              .first();
            if (locale === "en-us" && count === 1) {
              await summary.screenshot({
                path: testInfo.outputPath(`${route}-single-count.png`),
              });
            }
            await expect
              .soft(summary.locator("p"))
              .toHaveText(
                locale === "en-us"
                  ? new RegExp(
                      `^Showing ${count} of ${count} ${count === 1 ? singular : plural}(?:\\s|$)`,
                    )
                  : new RegExp(
                      `^显示 ${count} ${chinese}中的 ${count} ${chinese[0]}`,
                    ),
              );
          }
        }
      }
    });
  },
);
