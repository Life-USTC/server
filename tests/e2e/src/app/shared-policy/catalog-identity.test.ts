import { expect } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import { test as subscriptionTest } from "../../../utils/catalog-subscription-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";
import { observeSectionDetailNavigation } from "../../../utils/section-detail-navigation";

async function createFixture(db: TestPrismaClient) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const base = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);
  return db.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        id: base,
        jwId: base + 1,
        code: `IDENTITY-${suffix}`,
        nameCn: "身份显示测试课程",
        nameEn: "Identity display course",
      },
    });
    const teacher = await tx.teacher.create({
      data: {
        id: base + 2,
        jwId: base + 3,
        code: `TEACHER-${suffix}`,
        nameCn: "身份显示测试教师",
        nameEn: "Identity display teacher",
      },
    });
    const section = await tx.section.create({
      data: {
        id: base + 4,
        jwId: base + 5,
        code: `${course.code}.01`,
        courseId: course.id,
        teachers: { connect: { id: teacher.id } },
      },
    });
    const user = await tx.user.create({
      data: {
        id: crypto.randomUUID(),
        name: "Identity display user",
        username: `identity${suffix}`,
        email: `identity-${suffix}@example.test`,
      },
    });
    return { course, teacher, section, user };
  });
}

test("mobile catalog cards retain list and link semantics", {
  tag: "@Catalog/Web",
}, async ({ preferenceFlow, isolatedWorker, page }) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      (
        await preferenceFlow.http(() =>
          page.request.post("/api/account/preferences", {
            headers: preferenceFlow.headers,
            data: { locale: "zh-cn" },
          }),
        )
      ).status(),
    ).toBe(200);
    if (!fixture.teacher.code)
      throw new Error("Teacher fixture must have a public code");
    for (const [route, search, name, destination] of [
      [
        "courses",
        fixture.course.code,
        fixture.course.nameCn,
        fixture.course.jwId,
      ],
      [
        "sections",
        fixture.course.code,
        fixture.course.nameCn,
        fixture.section.jwId,
      ],
      [
        "teachers",
        fixture.teacher.code,
        fixture.teacher.nameCn,
        fixture.teacher.id,
      ],
    ] as const) {
      await gotoAndWaitForReady(page, `/catalog/${route}?search=${search}`);
      const item = page
        .getByRole("listitem")
        .filter({ has: page.getByText(name, { exact: true }) })
        .filter({ visible: true });
      await expect(item).toHaveCount(1);
      const link = item.getByRole("link");
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAccessibleName(new RegExp(name));
      await expect(link).toHaveAttribute(
        "href",
        `/catalog/${route}/${destination}`,
      );
      await link.focus();
      await expect(link).toBeFocused();
      const expectSectionDetailReady =
        route === "sections"
          ? observeSectionDetailNavigation(page, preferenceFlow, destination)
          : undefined;
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(
        new RegExp(`/catalog/${route}/${destination}$`),
      );
      if (expectSectionDetailReady) await expectSectionDetailReady();
    }
  });
});

test("ui.global-search-results-1", { tag: "@Search/Web" }, async ({
  preferenceFlow,
  isolatedWorker,
  page,
}) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    const homeworkTitle = `email homework ${fixture.course.code}`;
    const todoTitle = `email todo ${fixture.course.code}`;
    await isolatedWorker.database.owner.$transaction(async (db) => {
      await db.course.update({
        where: { id: fixture.course.id },
        data: { nameCn: "email课程", nameEn: "email course" },
      });
      await db.teacher.update({
        where: { id: fixture.teacher.id },
        data: { nameCn: "email教师", nameEn: "email teacher" },
      });
      await db.userSectionSubscription.create({
        data: { userId: fixture.user.id, sectionId: fixture.section.id },
      });
      await db.homework.create({
        data: {
          title: homeworkTitle,
          sectionId: fixture.section.id,
          createdById: fixture.user.id,
        },
      });
      await db.todo.create({
        data: { title: todoTitle, userId: fixture.user.id },
      });
    });
    for (const signedIn of [false, true]) {
      if (signedIn)
        await page
          .context()
          .addCookies([
            (await isolatedWorker.createSession(fixture.user.id)).cookie,
          ]);
      await gotoAndWaitForReady(page, "/search?q=email");
      const expected = [
        "sections",
        "teachers",
        "courses",
        "links",
        ...(signedIn ? ["homeworks", "todos"] : []),
      ];
      const groups = page.getByRole("listbox").getByRole("group");
      await expect(groups).toHaveCount(expected.length);
      expect(
        await groups.evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("aria-labelledby")),
        ),
      ).toEqual(expected.map((type) => `global-search-group-${type}`));
      for (const group of await groups.all()) {
        await expect(group.getByRole("option").first()).toBeVisible();
      }
      for (const [group, title] of [
        ["homeworks", homeworkTitle],
        ["todos", todoTitle],
      ]) {
        if (signedIn) {
          const results = page.locator(
            `[role="group"][aria-labelledby="global-search-group-${group}"]`,
          );
          await expect(
            results
              .getByRole("option")
              .filter({ has: page.getByText(title, { exact: true }) }),
          ).toHaveCount(1);
        } else {
          await expect(page.getByText(title, { exact: true })).toHaveCount(0);
        }
      }
    }
  });
});

test("ui.global-search-results-2", { tag: "@Search/Web" }, async ({
  preferenceFlow,
  isolatedWorker,
  page,
}) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    const { campus, teacherA, teacherB, noTeacher } =
      await isolatedWorker.database.owner.$transaction(async (db) => {
        const campus = await db.campus.create({
          data: {
            jwId: fixture.course.jwId + 10,
            nameCn: "身份测试校区",
            nameEn: "Identity campus",
          },
        });

        const semester = await db.semester.create({
          data: {
            jwId: fixture.course.jwId + 10,
            code: fixture.course.code,
            nameCn: "2015年秋季学期",
          },
        });

        const teacherA = await db.teacher.update({
          where: { id: fixture.teacher.id },
          data: {
            nameCn: "A 教师",
            nameEn: "Teacher A",
          },
        });
        const teacherB = await db.teacher.create({
          data: {
            id: fixture.teacher.id + 10,
            jwId: fixture.teacher.jwId + 10,
            code: `${fixture.course.code}-B`,
            nameCn: "B 教师",
            nameEn: "Teacher B",
          },
        });

        await db.section.update({
          where: { id: fixture.section.id },
          data: {
            campusId: campus.id,
            semesterId: semester.id,
            teachers: { connect: { id: teacherB.id } },
          },
        });
        const noTeacher = await db.section.create({
          data: {
            id: fixture.section.id + 10,
            jwId: fixture.section.jwId + 10,
            code: `${fixture.course.code}.02`,
            courseId: fixture.course.id,
          },
        });

        return { campus, teacherA, teacherB, noTeacher };
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
      const courseName =
        locale === "zh-cn" ? fixture.course.nameCn : fixture.course.nameEn;
      if (!courseName)
        throw new Error("Course fixture must provide both localized names");
      const teachers =
        locale === "zh-cn"
          ? `${teacherA.nameCn}、${teacherB.nameCn}`
          : `${teacherA.nameEn}, ${teacherB.nameEn}`;
      const campusName = locale === "zh-cn" ? campus.nameCn : campus.nameEn;
      for (const [section, title, description] of [
        [
          fixture.section,
          `${courseName} · ${teachers}`,
          `${locale === "zh-cn" ? "2015年秋季学期" : "Fall 2015"} · ${campusName} · ${fixture.section.code}`,
        ],
        [
          noTeacher,
          courseName,
          `${locale === "zh-cn" ? "未知" : "Unknown"} · ${noTeacher.code}`,
        ],
      ] as const) {
        await gotoAndWaitForReady(page, `/search?q=${fixture.course.code}`);
        const result = page
          .getByRole("group", {
            name: locale === "zh-cn" ? "班级" : "Sections",
            exact: true,
          })
          .getByRole("option")
          .filter({ has: page.getByText(title, { exact: true }) });
        await expect(result).toHaveCount(1);
        await expect
          .poll(async () =>
            (await result.innerText()).replace(/\s+/g, " ").trim(),
          )
          .toBe(`${title} ${description}`);
        const expectSectionDetailReady = observeSectionDetailNavigation(
          page,
          preferenceFlow,
          section.jwId,
        );
        await result.click();
        await expect(page).toHaveURL(
          new RegExp(`/catalog/sections/${section.jwId}$`),
        );
        await expectSectionDetailReady();
      }
    }
  });
});

test("ui.global-search-results-3", { tag: "@Search/Web" }, async ({
  preferenceFlow,
  isolatedWorker,
  page,
}) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
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
      await gotoAndWaitForReady(page, `/search?q=${fixture.course.code}`);
      const name =
        locale === "zh-cn" ? fixture.course.nameCn : fixture.course.nameEn;
      if (!name)
        throw new Error("Course fixture must provide both localized names");
      const result = page
        .getByRole("option")
        .filter({ has: page.getByText(name, { exact: true }) });
      await expect(result).toHaveCount(1);
      expect((await result.innerText()).trim()).toBe(
        `${name}\n${fixture.course.code}`,
      );
      await result.click();
      await expect(page).toHaveURL(
        new RegExp(`/catalog/courses/${fixture.course.jwId}$`),
      );
    }
  });
});

test(
  "ui.global-search-results-4",
  { tag: "@Search/Web" },
  async ({ preferenceFlow, isolatedWorker, page }, testInfo) => {
    await preferenceFlow.run(async () => {
      const fixture = await createFixture(isolatedWorker.database.owner);
      const marker = crypto.randomUUID().slice(0, 8);
      const department = await isolatedWorker.database.owner.$transaction(
        (db) =>
          db.department.create({
            data: {
              code: `DEPT-${marker}`,
              nameCn: `测试院系 ${marker}`,
              nameEn: `Test department ${marker}`,
            },
          }),
      );

      const withDepartment = await isolatedWorker.database.owner.$transaction(
        (db) =>
          db.teacher.update({
            where: { id: fixture.teacher.id },
            data: {
              departmentId: department.id,
              nameCn: `教师 ${marker} 甲`,
              nameEn: `Teacher ${marker} A`,
            },
          }),
      );
      const codeOnly = await isolatedWorker.database.owner.$transaction((db) =>
        db.teacher.create({
          data: {
            id: fixture.teacher.id + 6,
            jwId: fixture.teacher.jwId + 6,
            code: `TC-${marker}`,
            nameCn: `教师 ${marker} 乙`,
            nameEn: `Teacher ${marker} B`,
          },
        }),
      );

      const noContext = await isolatedWorker.database.owner.$transaction((db) =>
        db.teacher.create({
          data: {
            id: fixture.teacher.id + 8,
            jwId: fixture.teacher.jwId + 8,
            code: "",
            nameCn: `教师 ${marker} 丙`,
            nameEn: `Teacher ${marker} C`,
          },
        }),
      );

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
        await gotoAndWaitForReady(page, `/search?q=${marker}`);
        for (const teacher of [withDepartment, codeOnly, noContext]) {
          const name = locale === "zh-cn" ? teacher.nameCn : teacher.nameEn;
          if (!name)
            throw new Error(
              "Teacher fixture must provide both localized names",
            );
          const context =
            teacher.id === withDepartment.id
              ? locale === "zh-cn"
                ? department.nameCn
                : department.nameEn
              : teacher.code;
          const result = page
            .getByRole("option")
            .filter({ has: page.getByText(name, { exact: true }) });
          if (locale === "en-us" && teacher.id === withDepartment.id)
            await page.screenshot({
              path: testInfo.outputPath("teacher-search-context.png"),
              fullPage: true,
            });
          await expect(result).toHaveCount(1);
          const visible = await result.innerText();
          expect(visible.trim()).toBe(context ? `${name}\n${context}` : name);
          expect(visible).not.toContain(String(teacher.id));
          expect(visible).not.toContain(String(teacher.jwId));
        }
        const name =
          locale === "zh-cn" ? withDepartment.nameCn : withDepartment.nameEn;
        if (!name)
          throw new Error("Teacher fixture must provide both localized names");
        await page
          .getByRole("option")
          .filter({ has: page.getByText(name, { exact: true }) })
          .click();
        await expect(page).toHaveURL(
          new RegExp(`/catalog/teachers/${withDepartment.id}$`),
        );
      }
    });
  },
);

test(
  "ui.data-table-cells-2",
  { tag: "@Catalog/Web" },
  async ({ preferenceFlow, isolatedWorker, page, baseURL }, testInfo) => {
    await preferenceFlow.run(async () => {
      const fixture = await createFixture(isolatedWorker.database.owner);
      const courseName =
        "Complete course title with extensive catalog context and a distinguishing final phrase";
      const teacherName =
        "Complete teacher name with extensive catalog context and a distinguishing final phrase";
      const sectionCode = `${fixture.section.code}-COMPLETE-PUBLIC-SECTION-CODE-END`;
      const values = [courseName, sectionCode, teacherName];
      const path = `/catalog/sections?search=${fixture.course.code}`;
      const touchContext = await preferenceFlow.newContext({
        baseURL,
        hasTouch: true,
        viewport: { width: 1280, height: 900 },
      });
      await isolatedWorker.database.owner.$transaction(async (db) => {
        await db.course.update({
          where: { id: fixture.course.id },
          data: { nameCn: courseName, nameEn: courseName },
        });
        await db.teacher.update({
          where: { id: fixture.teacher.id },
          data: { nameCn: teacherName, nameEn: teacherName },
        });
        await db.section.update({
          where: { id: fixture.section.id },
          data: { code: sectionCode },
        });
      });
      const touchPage = await preferenceFlow.newPage(touchContext);
      for (const width of [1280, 390]) {
        await touchPage.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(touchPage, path, {
          browserHealth: {},
          expectMeaningfulContent: true,
        });
        expect(
          await touchPage.evaluate(() => matchMedia("(hover: none)").matches),
        ).toBe(true);
        await touchPage.screenshot({
          path: testInfo.outputPath(`truncation-touch-${width}.png`),
          fullPage: true,
        });
        for (const value of values) {
          const text = touchPage
            .locator("#main-content")
            .getByText(value, { exact: width !== 390 || value !== teacherName })
            .filter({ visible: true });
          await expect(text).toHaveCount(1);
          const geometry = await text.evaluate((element) => ({
            width: element.clientWidth,
            scrollWidth: element.scrollWidth,
            height: element.clientHeight,
            scrollHeight: element.scrollHeight,
          }));
          expect(
            geometry.scrollWidth,
            `Touch value is horizontally clipped: ${value}`,
          ).toBeLessThanOrEqual(geometry.width + 1);
          expect(
            geometry.scrollHeight,
            `Touch value is vertically clipped: ${value}`,
          ).toBeLessThanOrEqual(geometry.height + 1);
        }
        expect(
          await touchPage.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
      }
      const expectSectionDetailReady = observeSectionDetailNavigation(
        touchPage,
        preferenceFlow,
        fixture.section.jwId,
      );
      await touchPage
        .getByRole("link")
        .filter({ has: touchPage.getByText(courseName, { exact: true }) })
        .tap();
      await expect(touchPage).toHaveURL(
        new RegExp(`/catalog/sections/${fixture.section.jwId}$`),
      );
      await expectSectionDetailReady();

      await page.setViewportSize({ width: 1280, height: 900 });
      await gotoAndWaitForReady(page, path, {
        browserHealth: {},
        expectMeaningfulContent: true,
      });
      for (const value of values) {
        const text = page
          .locator('#main-content [data-slot="truncated-text"]')
          .filter({ hasText: value, visible: true });
        expect(
          await text.evaluate(
            (element) => element.scrollWidth > element.clientWidth,
          ),
        ).toBe(true);
        await text.hover();
        const tooltip = page.locator('[data-slot="tooltip-content"]:visible');
        await expect(tooltip).toHaveText(value);
        await page.keyboard.press("Escape");
        await expect(tooltip).toHaveCount(0);
      }
      const link = page
        .getByRole("link", { name: courseName, exact: true })
        .filter({ visible: true });
      await link.focus();
      for (const value of values) {
        const focused = page.locator(":focus");
        await expect(focused).toContainText(value);
        await expect(
          page.locator('[data-slot="tooltip-content"]:visible'),
        ).toHaveText(value);
        expect(await focused.ariaSnapshot()).toContain(value);
        await page.keyboard.press("Escape");
        await expect(
          page.locator('[data-slot="tooltip-content"]:visible'),
        ).toHaveCount(0);
        await page.keyboard.press("Tab");
      }
      const code = page
        .locator("#main-content")
        .getByText(sectionCode, { exact: true })
        .filter({ visible: true });
      await code.hover();
      await expect(
        page.locator('[data-slot="tooltip-content"]:visible'),
      ).toHaveText(sectionCode);
      await page.screenshot({
        path: testInfo.outputPath("truncation-pointer.png"),
        fullPage: true,
      });
    });
  },
);

test("ui.data-table-cells-3", { tag: "@Catalog/Web" }, async ({
  preferenceFlow,
  isolatedWorker,
  page,
}) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [path, code] of [
        [`/catalog/courses?search=${fixture.course.code}`, fixture.course.code],
        [
          `/catalog/sections?search=${fixture.section.code}`,
          fixture.section.code,
        ],
        [`/catalog/courses/${fixture.course.jwId}`, fixture.course.code],
        [`/catalog/courses/${fixture.course.jwId}`, fixture.section.code],
        [`/catalog/sections/${fixture.section.jwId}`, fixture.section.code],
        [`/catalog/teachers/${fixture.teacher.id}`, fixture.section.code],
      ]) {
        await gotoAndWaitForReady(page, path);
        const label = page
          .locator("#main-content")
          .getByText(code, { exact: true })
          .filter({ visible: true });
        await expect(label.first()).toBeVisible();
        const presentations = await label.evaluateAll((elements) =>
          elements.map((element) => ({
            family: getComputedStyle(element).fontFamily,
            inBadge: element.closest('[data-slot="badge"]') !== null,
          })),
        );
        for (const presentation of presentations) {
          expect(presentation.family).toMatch(/monospace|mono/i);
          expect(presentation.inBadge).toBe(false);
        }
      }
    }
  });
});

test("permission-ui.identity-4", { tag: "@Catalog/Web" }, async ({
  preferenceFlow,
  isolatedWorker,
  page,
}) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    const { course, teacher, section, user } = fixture;
    const forbidden = [
      course.id,
      course.jwId,
      teacher.id,
      teacher.jwId,
      section.id,
      section.jwId,
      user.id,
    ].map(String);
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
      for (const [path, name, code] of [
        [
          `/catalog/courses/${course.jwId}`,
          locale === "zh-cn" ? course.nameCn : course.nameEn,
          course.code,
        ],
        [
          `/catalog/sections/${section.jwId}`,
          locale === "zh-cn" ? course.nameCn : course.nameEn,
          section.code,
        ],
        [
          `/catalog/teachers/${teacher.id}`,
          locale === "zh-cn" ? teacher.nameCn : teacher.nameEn,
          section.code,
        ],
      ]) {
        if (!path || !name || !code)
          throw new Error("Incomplete identity fixture");
        await gotoAndWaitForReady(page, path);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          name,
        );
        await expect(page.locator("#main-content")).toContainText(code);
        const visible = await page.locator("#main-content").innerText();
        for (const id of forbidden) expect(visible).not.toContain(id);
        for (const id of forbidden)
          expect(await page.title()).not.toContain(id);
      }
    }
    await page
      .context()
      .addCookies([(await isolatedWorker.createSession(user.id)).cookie]);
    for (const path of [
      "/account/settings",
      `/community/users/${user.username}`,
    ]) {
      await gotoAndWaitForReady(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.locator("#main-content").innerText()).not.toContain(
        user.id,
      );
      expect(await page.title()).not.toContain(user.id);
    }
    const courseResponse = await preferenceFlow.http(() =>
      page.request.get(`/api/catalog/courses/${course.jwId}`, {
        headers: preferenceFlow.headers,
      }),
    );
    expect(courseResponse.status()).toBe(200);
    expect(await courseResponse.json()).toMatchObject({
      jwId: course.jwId,
      code: course.code,
    });
    const sectionResponse = await preferenceFlow.http(() =>
      page.request.get(`/api/catalog/sections/${section.jwId}`, {
        headers: preferenceFlow.headers,
      }),
    );
    expect(sectionResponse.status()).toBe(200);
    expect(await sectionResponse.json()).toMatchObject({
      jwId: section.jwId,
      code: section.code,
    });
  });
});

test("cases.missing-data.section-missing-teacher-location-or-exam-1", {
  tag: "@Catalog/Web",
}, async ({ preferenceFlow, isolatedWorker, page }) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    await isolatedWorker.database.owner.$transaction((db) =>
      db.section.update({
        where: { id: fixture.section.id },
        data: { teachers: { set: [] } },
      }),
    );
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
      await gotoAndWaitForReady(
        page,
        `/catalog/sections/${fixture.section.jwId}`,
      );
      const name =
        locale === "zh-cn" ? fixture.course.nameCn : fixture.course.nameEn;
      if (!name) throw new Error("Missing localized fixture name");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
      await expect(page.locator("#teachers")).toContainText(
        locale === "zh-cn" ? "暂无教师。" : "No teachers listed.",
      );
      const campus = page
        .locator("[data-detail-identity] dt")
        .filter({ hasText: locale === "zh-cn" ? "校区" : "Campus" });
      await expect(campus.locator("+ dd")).toHaveText(
        locale === "zh-cn" ? "暂无" : "N/A",
      );
      for (const region of ["#calendar", "#exams"]) {
        await expect(page.locator(region)).toContainText(
          locale === "zh-cn"
            ? "此班级暂无课程或考试安排"
            : "No schedule or exam events available for this section",
        );
      }
      expect(await page.locator("#main-content").innerText()).not.toMatch(
        /取消|cancelled|canceled/i,
      );
      const response = await preferenceFlow.http(() =>
        page.request.get(`/api/catalog/sections/${fixture.section.jwId}`, {
          headers: preferenceFlow.headers,
        }),
      );
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        jwId: fixture.section.jwId,
        teachers: [],
        exams: [],
        schedules: [],
      });
    }
  });
});

test("cases.missing-data.ical-no-events-1", { tag: "@Calendar/ICS" }, async ({
  preferenceFlow,
  isolatedWorker,
  page,
  request,
}) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    const feed = await isolatedWorker.database.owner.$transaction((db) =>
      db.user.update({
        where: { id: fixture.user.id },
        data: {
          calendarFeedToken: crypto.randomUUID(),
        },
      }),
    );
    const personal = `/api/calendar-feeds/${fixture.user.id}.ics`;
    for (const url of [
      `/api/catalog/sections/${fixture.section.jwId}/calendar.ics`,
      `/api/catalog/sections/calendar.ics?sectionIds=${fixture.section.id}`,
      `${personal}?token=${feed.calendarFeedToken}`,
    ]) {
      const response = await preferenceFlow.http(() =>
        request.get(url, { headers: preferenceFlow.headers }),
      );
      expect(response.status(), url).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/calendar");
      const text = await response.text();
      const lines = text
        .replace(/\r\n[ \t]/g, "")
        .trim()
        .split("\r\n");
      expect(lines[0]).toBe("BEGIN:VCALENDAR");
      expect(lines.at(-1)).toBe("END:VCALENDAR");
      expect(lines.filter((line) => line === "VERSION:2.0")).toHaveLength(1);
      expect(lines.filter((line) => line.startsWith("PRODID:"))).toHaveLength(
        1,
      );
      expect(lines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(0);
      expect(lines.filter((line) => line.startsWith("SUMMARY:"))).toHaveLength(
        0,
      );
    }
    expect(
      (
        await preferenceFlow.http(() =>
          request.get(personal, { headers: preferenceFlow.headers }),
        )
      ).status(),
    ).toBe(401);
    expect(
      (
        await preferenceFlow.http(() =>
          request.get(`${personal}?token=incorrect`, {
            headers: preferenceFlow.headers,
          }),
        )
      ).status(),
    ).toBe(410);
    expect(
      (
        await preferenceFlow.http(() =>
          request.get(
            `/api/calendar-feeds/${crypto.randomUUID()}.ics?token=incorrect`,
            { headers: preferenceFlow.headers },
          ),
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await preferenceFlow.http(() =>
          request.get(
            `/api/catalog/sections/${fixture.section.jwId + 10}/calendar.ics`,
            { headers: preferenceFlow.headers },
          ),
        )
      ).status(),
    ).toBe(404);
    await page
      .context()
      .addCookies([
        (await isolatedWorker.createSession(fixture.user.id)).cookie,
      ]);
    const own = await preferenceFlow.http(() =>
      page.request.get(personal, { headers: preferenceFlow.headers }),
    );
    expect(own.status()).toBe(200);
    expect(await own.text()).not.toContain("BEGIN:VEVENT");
    expect(
      (
        await preferenceFlow.http(() =>
          page.request.get(`/api/calendar-feeds/${crypto.randomUUID()}.ics`, {
            headers: preferenceFlow.headers,
          }),
        )
      ).status(),
    ).toBe(403);
  });
});

for (const [domain, method] of [
  ["Homework", "Web"],
  ["Homework", "REST"],
  ["Overview", "REST"],
] as const) {
  test(`cases.missing-data.homework-no-due-date-1 ${domain}/${method}`, {
    tag: `@${domain}/${method}`,
  }, async ({ preferenceFlow, isolatedWorker, page }) => {
    await preferenceFlow.run(async () => {
      const fixture = await createFixture(isolatedWorker.database.owner);
      const homework = await isolatedWorker.database.owner.$transaction(
        async (db) => {
          await db.userSectionSubscription.create({
            data: { userId: fixture.user.id, sectionId: fixture.section.id },
          });
          return db.homework.create({
            data: {
              sectionId: fixture.section.id,
              createdById: fixture.user.id,
              title: "Undated homework stays reachable",
              publishedAt: new Date("2026-01-01T00:00:00Z"),
              submissionDueAt: null,
            },
          });
        },
      );
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(fixture.user.id)).cookie,
        ]);
      if (method === "Web") {
        await gotoAndWaitForReady(page, "/workspace/homeworks");
        await page.getByRole("radio", { name: /^(全部|All)$/i }).click();
        const row = page.getByRole("row").filter({ hasText: homework.title });
        await expect(row).toBeVisible();
        await expect(row).toContainText(/日期待定|Date TBD/i);
      }
      if (domain === "Homework" && method === "REST") {
        const list = await preferenceFlow.http(() =>
          page.request.get("/api/workspace/homeworks", {
            headers: preferenceFlow.headers,
          }),
        );
        expect(list.status()).toBe(200);
        const body = await list.json();
        expect(body.data).toEqual([
          expect.objectContaining({ id: homework.id, submissionDueAt: null }),
        ]);
      }
      if (domain === "Overview") {
        for (const atTime of [
          "2026-04-29T08:00:00+08:00",
          "2026-10-01T08:00:00+08:00",
        ]) {
          for (const homeworkWindowDays of [1, 7]) {
            const overview = await preferenceFlow.http(() =>
              page.request.get(
                `/api/workspace/overview?${new URLSearchParams({ atTime, homeworkWindowDays: String(homeworkWindowDays) })}`,
                { headers: preferenceFlow.headers },
              ),
            );
            expect(overview.status()).toBe(200);
            expect(await overview.json()).toMatchObject({
              counts: { pendingHomeworks: 1, dueSoonHomeworks: 0 },
              homeworks: { total: 0, items: [] },
            });
          }
        }
      }
      if (domain === "Homework" && method === "REST") {
        const sectionList = await preferenceFlow.http(() =>
          page.request.get(
            `/api/community/section-homeworks?sectionId=${fixture.section.id}`,
            { headers: preferenceFlow.headers },
          ),
        );
        expect(sectionList.status()).toBe(200);
        expect(JSON.stringify(await sectionList.json())).toContain(homework.id);
      }
      expect(
        (
          await isolatedWorker.database.owner.$transaction((db) =>
            db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
          )
        ).submissionDueAt,
      ).toBeNull();
    });
  });
}

test("cases.disambiguation.duplicate-course-names-1", {
  tag: "@Catalog/Web",
}, async ({ preferenceFlow, isolatedWorker, page }) => {
  await preferenceFlow.run(async () => {
    const fixture = await createFixture(isolatedWorker.database.owner);
    const second = await isolatedWorker.database.owner.$transaction((db) =>
      db.course.create({
        data: {
          id: fixture.course.id + 6,
          jwId: fixture.course.jwId + 6,
          code: `${fixture.course.code}-OTHER`,
          nameCn: fixture.course.nameCn,
          nameEn: fixture.course.nameEn,
        },
      }),
    );
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
      const name =
        locale === "zh-cn" ? fixture.course.nameCn : fixture.course.nameEn;
      if (!name) throw new Error("Missing fixture course name");
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(
          page,
          `/catalog/courses?search=${encodeURIComponent(fixture.course.nameCn)}`,
        );
        for (const course of [fixture.course, second]) {
          const row = page
            .getByRole(width < 768 ? "listitem" : "row")
            .filter({
              has: page.locator(`a[href="/catalog/courses/${course.jwId}"]`),
            })
            .filter({ visible: true });
          await expect(row).toHaveCount(1);
          await expect(row).toContainText(name);
          await expect(row).toContainText(course.code);
          await expect(
            row.locator(`a[href="/catalog/courses/${course.jwId}"]`),
          ).toBeVisible();
        }
        await gotoAndWaitForReady(
          page,
          `/search?q=${encodeURIComponent(fixture.course.nameCn)}`,
        );
        for (const course of [fixture.course, second]) {
          const result = page
            .getByRole("option")
            .filter({ hasText: course.code });
          const exact = result.filter({
            has: page.getByText(course.code, { exact: true }),
          });
          await expect(exact).toHaveCount(1);
          await expect(exact).toContainText(name);
        }
      }
    }
  });
});

subscriptionTest(
  "cases.disambiguation.multiple-sections-same-course-1",
  { tag: "@Catalog/Web" },
  async ({ page, isolatedWorker, run, catalogSubscriptionRun }, testInfo) => {
    subscriptionTest.setTimeout(60_000);
    const db = isolatedWorker.database.owner;
    const { fixture, current, previous, sections } = await run(async () => {
      const fixture = await createFixture(db);
      return db.$transaction(async (db) => {
        const current = await db.semester.create({
          data: { jwId: 9_900_001, code: "421", nameCn: "2026年春季学期" },
        });
        const previous = await db.semester.create({
          data: { jwId: 9_900_000, code: "420", nameCn: "2025年秋季学期" },
        });
        const sections = [];
        for (const [index, semester] of [
          current,
          current,
          previous,
        ].entries()) {
          sections.push(
            await db.section.create({
              data: {
                id: fixture.section.id + 2 * (index + 1),
                jwId: fixture.section.jwId + 2 * (index + 1),
                code: `${fixture.course.code}.0${index + 2}`,
                courseId: fixture.course.id,
                semesterId: semester.id,
              },
            }),
          );
        }
        return { fixture, current, previous, sections };
      });
    });
    await catalogSubscriptionRun(
      fixture.user,
      {
        calendarTokenCreated: true,
        calendarMessages: Array.from({ length: 2 }, () => ({
          type: "user" as const,
          userId: fixture.user.id,
        })),
      },
      async (effects) => {
        let completedImports = 0;
        for (const locale of ["zh-cn", "en-us"]) {
          expect(
            (
              await page.request.post("/api/account/preferences", {
                headers: effects.headers,
                data: { locale },
              })
            ).status(),
          ).toBe(200);
          const name =
            locale === "zh-cn" ? fixture.course.nameCn : fixture.course.nameEn;
          if (!name) throw new Error("Missing localized course name");
          await gotoAndWaitForReady(
            page,
            `/search?q=${encodeURIComponent(fixture.course.code)}`,
          );
          for (const section of [fixture.section, ...sections]) {
            const result = page
              .getByRole("option")
              .filter({ hasText: section.code });
            await expect(result).toHaveCount(1);
            await expect(result).toContainText(name);
            const semesterLabel =
              section.semesterId === current.id
                ? locale === "zh-cn"
                  ? "2026年春季学期"
                  : "Spring 2026"
                : section.semesterId === previous.id
                  ? locale === "zh-cn"
                    ? "2025年秋季学期"
                    : "Fall 2025"
                  : locale === "zh-cn"
                    ? "未知"
                    : "Unknown";
            if (section.id === fixture.section.id && locale === "zh-cn") {
              await page.screenshot({
                path: testInfo.outputPath("section-semester-after.png"),
                fullPage: true,
              });
            }
            await expect(result).toContainText(semesterLabel);
          }
          for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await gotoAndWaitForReady(
              page,
              `/catalog/courses/${fixture.course.jwId}`,
            );
            await expect(page.getByRole("heading", { level: 1 })).toContainText(
              name,
            );
            const courseFacts = await page.locator("#overview").innerText();
            expect(courseFacts).not.toContain(current.nameCn);
            expect(courseFacts).not.toContain(previous.nameCn);
            for (const section of [fixture.section, ...sections]) {
              const link = page
                .locator(`a[href="/catalog/sections/${section.jwId}"]`)
                .filter({ visible: true });
              const row =
                width < 768
                  ? link
                  : page.getByRole("row").filter({ has: link });
              await expect(row).toContainText(section.code);
              await expect(row).toContainText(
                section.semesterId === current.id
                  ? locale === "zh-cn"
                    ? current.nameCn
                    : "Spring 2026"
                  : section.semesterId === previous.id
                    ? locale === "zh-cn"
                      ? previous.nameCn
                      : "Fall 2025"
                    : locale === "zh-cn"
                      ? "暂无"
                      : "N/A",
              );
            }
          }
          const courseResponse = await page.request.get(
            `/api/catalog/courses/${fixture.course.jwId}`,
            { headers: effects.headers },
          );
          expect(courseResponse.status()).toBe(200);
          const coursePayload = await courseResponse.json();
          expect(Object.hasOwn(coursePayload, "semester")).toBe(false);
          expect(Object.hasOwn(coursePayload, "semesterId")).toBe(false);
          await page
            .context()
            .addCookies([
              (await isolatedWorker.createSession(fixture.user.id)).cookie,
            ]);
          await gotoAndWaitForReady(page, "/workspace/subscriptions");
          await page
            .getByRole("button", {
              name: /批量添加订阅|Bulk Add Subscriptions/i,
            })
            .first()
            .click();
          await page
            .locator("#bulk-import-semester")
            .selectOption(String(current.id));
          await page.locator("#bulk-import-section-codes").fill(
            sections
              .slice(0, 2)
              .map((section) => section.code)
              .join("\n"),
          );
          await page
            .getByRole("button", { name: /识别并匹配课程|Match Sections/ })
            .click();
          const dialog = page.getByRole("dialog", {
            name: /确认订阅|Confirm .*section subscriptions/,
          });
          await expect(dialog).toBeVisible();
          await expect(dialog.getByRole("checkbox")).toHaveCount(2);
          for (const section of sections.slice(0, 2)) {
            const field = dialog.locator('[data-slot="field"]').filter({
              has: page.locator(`#bulk-import-section-${section.id}`),
            });
            await expect(field).toContainText(name);
            await expect(field).toContainText(section.code);
            await expect(field).toContainText(
              locale === "zh-cn" ? current.nameCn : "Spring 2026",
            );
          }
          const [saved] = await Promise.all([
            page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname ===
                  "/api/workspace/subscriptions/batch" &&
                response.request().method() === "POST",
            ),
            dialog
              .getByRole("button", {
                name: /订阅已选的 2 个教学班|Subscribe to 2 sections/,
              })
              .click(),
          ]);
          expect(saved.status()).toBe(200);
          expect(await saved.json()).toMatchObject({
            addedCount: 2,
            removedCount: 0,
            total: 2,
            subscription: { userId: fixture.user.id },
          });
          await expect(dialog).toBeHidden();
          for (const section of sections.slice(0, 2)) {
            await expect(
              page
                .locator(`a[href="/catalog/sections/${section.jwId}"]`)
                .filter({ visible: true })
                .first(),
            ).toContainText(name);
          }
          expect(
            await db.userSectionSubscription.findMany({
              select: { userId: true, sectionId: true, kind: true },
              orderBy: { sectionId: "asc" },
            }),
          ).toEqual(
            sections.slice(0, 2).map((section) => ({
              userId: fixture.user.id,
              sectionId: section.id,
              kind: "regular",
            })),
          );
          completedImports++;
          // Drain this locale's actual calendar deliveries before resetting the
          // owned rows for the next locale's independent import interaction.
          await effects.checkpoint(`catalog-import-${locale}`, {
            calendarTokenCreated: true,
            calendarMessages: Array.from({ length: completedImports }, () => ({
              type: "user" as const,
              userId: fixture.user.id,
            })),
          });
          await db.$transaction((db) =>
            db.userSectionSubscription.deleteMany({
              where: { userId: fixture.user.id },
            }),
          );
        }
      },
    );
  },
);
