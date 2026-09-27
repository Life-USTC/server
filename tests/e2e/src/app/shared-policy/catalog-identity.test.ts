import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function createFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const base = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);
  return withE2ePrisma((db) =>
    db.$transaction(async (tx) => {
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
          name: "Identity display user",
          username: `identity${suffix}`,
          email: `identity-${suffix}@example.test`,
        },
      });
      return { course, teacher, section, user };
    }),
  );
}

async function cleanup(fixture: Awaited<ReturnType<typeof createFixture>>) {
  await withE2ePrisma(async (db) => {
    await db.section.delete({ where: { id: fixture.section.id } });
    await db.teacher.delete({ where: { id: fixture.teacher.id } });
    await db.course.delete({ where: { id: fixture.course.id } });
    await db.auditLog.deleteMany({
      where: {
        OR: [{ userId: fixture.user.id }, { subjectUserId: fixture.user.id }],
      },
    });
    await db.user.delete({ where: { id: fixture.user.id } });
  });
}

test("ui.global-search-results-4", async ({ page }, testInfo) => {
  const fixture = await createFixture();
  const marker = crypto.randomUUID().slice(0, 8);
  const extras: number[] = [];
  let departmentId: number | undefined;
  try {
    const department = await withE2ePrisma((db) =>
      db.department.create({
        data: {
          code: `DEPT-${marker}`,
          nameCn: `测试院系 ${marker}`,
          nameEn: `Test department ${marker}`,
        },
      }),
    );
    departmentId = department.id;
    const withDepartment = await withE2ePrisma((db) =>
      db.teacher.update({
        where: { id: fixture.teacher.id },
        data: {
          departmentId: department.id,
          nameCn: `教师 ${marker} 甲`,
          nameEn: `Teacher ${marker} A`,
        },
      }),
    );
    const codeOnly = await withE2ePrisma((db) =>
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
    extras.push(codeOnly.id);
    const noContext = await withE2ePrisma((db) =>
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
    extras.push(noContext.id);
    for (const locale of ["zh-cn", "en-us"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
        ).status(),
      ).toBe(200);
      await gotoAndWaitForReady(page, `/search?q=${marker}`);
      for (const teacher of [withDepartment, codeOnly, noContext]) {
        const name = locale === "zh-cn" ? teacher.nameCn : teacher.nameEn;
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
      await page
        .getByRole("option")
        .filter({ has: page.getByText(name, { exact: true }) })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`/catalog/teachers/${withDepartment.id}$`),
      );
    }
  } finally {
    await withE2ePrisma((db) =>
      db.teacher.deleteMany({ where: { id: { in: extras } } }),
    );
    await cleanup(fixture);
    if (departmentId)
      await withE2ePrisma((db) =>
        db.department.delete({ where: { id: departmentId } }),
      );
  }
});

test("permission-ui.identity-4", async ({ page }) => {
  const fixture = await createFixture();
  const { course, teacher, section, user } = fixture;
  try {
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
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
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
    await page.context().addCookies([await createSignedSessionCookie(user.id)]);
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
    const courseResponse = await page.request.get(
      `/api/catalog/courses/${course.jwId}`,
    );
    expect(courseResponse.status()).toBe(200);
    expect(await courseResponse.json()).toMatchObject({
      jwId: course.jwId,
      code: course.code,
    });
    const sectionResponse = await page.request.get(
      `/api/catalog/sections/${section.jwId}`,
    );
    expect(sectionResponse.status()).toBe(200);
    expect(await sectionResponse.json()).toMatchObject({
      jwId: section.jwId,
      code: section.code,
    });
  } finally {
    await cleanup(fixture);
  }
});

test("cases.missing-data.section-missing-teacher-location-or-exam-1", async ({
  page,
}) => {
  const fixture = await createFixture();
  try {
    await withE2ePrisma((db) =>
      db.section.update({
        where: { id: fixture.section.id },
        data: { teachers: { set: [] } },
      }),
    );
    for (const locale of ["zh-cn", "en-us"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
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
        .locator("#overview dt")
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
      const response = await page.request.get(
        `/api/catalog/sections/${fixture.section.jwId}`,
      );
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        jwId: fixture.section.jwId,
        teachers: [],
        exams: [],
        schedules: [],
      });
    }
  } finally {
    await cleanup(fixture);
  }
});

test("cases.missing-data.ical-no-events-1", async ({ page, request }) => {
  const fixture = await createFixture();
  try {
    const feed = await withE2ePrisma((db) =>
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
      const response = await request.get(url);
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
    expect((await request.get(personal)).status()).toBe(401);
    expect((await request.get(`${personal}?token=incorrect`)).status()).toBe(
      410,
    );
    expect(
      (
        await request.get(
          `/api/calendar-feeds/${crypto.randomUUID()}.ics?token=incorrect`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.get(
          `/api/catalog/sections/${fixture.section.jwId + 10}/calendar.ics`,
        )
      ).status(),
    ).toBe(404);
    await page
      .context()
      .addCookies([await createSignedSessionCookie(fixture.user.id)]);
    const own = await page.request.get(personal);
    expect(own.status()).toBe(200);
    expect(await own.text()).not.toContain("BEGIN:VEVENT");
    expect(
      (
        await page.request.get(`/api/calendar-feeds/${crypto.randomUUID()}.ics`)
      ).status(),
    ).toBe(403);
  } finally {
    await cleanup(fixture);
  }
});

test("cases.missing-data.homework-no-due-date-1", async ({ page }) => {
  const fixture = await createFixture();
  const homework = await withE2ePrisma(async (db) => {
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
  });
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(fixture.user.id)]);
    await gotoAndWaitForReady(page, "/workspace/homeworks");
    await page.getByRole("radio", { name: /^(全部|All)$/i }).click();
    const row = page.getByRole("row").filter({ hasText: homework.title });
    await expect(row).toBeVisible();
    await expect(row).toContainText(/日期待定|Date TBD/i);
    const list = await page.request.get("/api/workspace/homeworks");
    expect(list.status()).toBe(200);
    const body = await list.json();
    expect(body.data).toEqual([
      expect.objectContaining({ id: homework.id, submissionDueAt: null }),
    ]);
    for (const atTime of [
      "2026-04-29T08:00:00+08:00",
      "2026-10-01T08:00:00+08:00",
    ]) {
      for (const homeworkWindowDays of [1, 7]) {
        const overview = await page.request.get(
          `/api/workspace/overview?${new URLSearchParams({ atTime, homeworkWindowDays: String(homeworkWindowDays) })}`,
        );
        expect(overview.status()).toBe(200);
        expect(await overview.json()).toMatchObject({
          counts: { pendingHomeworks: 1, dueSoonHomeworks: 0 },
          homeworks: { total: 0, items: [] },
        });
      }
    }
    const sectionList = await page.request.get(
      `/api/community/section-homeworks?sectionId=${fixture.section.id}`,
    );
    expect(sectionList.status()).toBe(200);
    expect(JSON.stringify(await sectionList.json())).toContain(homework.id);
    expect(
      (
        await withE2ePrisma((db) =>
          db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
        )
      ).submissionDueAt,
    ).toBeNull();
  } finally {
    await withE2ePrisma((db) =>
      db.homework.delete({ where: { id: homework.id } }),
    );
    await cleanup(fixture);
  }
});

test("cases.disambiguation.duplicate-course-names-1", async ({ page }) => {
  const fixture = await createFixture();
  const second = await withE2ePrisma((db) =>
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
  try {
    for (const locale of ["zh-cn", "en-us"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
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
  } finally {
    await withE2ePrisma((db) => db.course.delete({ where: { id: second.id } }));
    await cleanup(fixture);
  }
});

test("cases.disambiguation.multiple-sections-same-course-1", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const fixture = await createFixture();
  const semesters = await withE2ePrisma((db) =>
    db.semester.findMany({
      where: {
        jwId: { in: [DEV_SEED.semesterJwId, DEV_SEED.previousSemesterJwId] },
      },
    }),
  );
  const current = semesters.find(
    (semester) => semester.jwId === DEV_SEED.semesterJwId,
  );
  const previous = semesters.find(
    (semester) => semester.jwId === DEV_SEED.previousSemesterJwId,
  );
  if (!current || !previous) throw new Error("Missing seeded semesters");
  const sections = await withE2ePrisma(async (db) => {
    const result = [];
    for (const [index, semester] of [current, current, previous].entries()) {
      result.push(
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
    return result;
  });
  try {
    for (const locale of ["zh-cn", "en-us"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
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
            width < 768 ? link : page.getByRole("row").filter({ has: link });
          await expect(row).toContainText(section.code);
          await expect(row).toContainText(
            section.semesterId === current.id
              ? current.nameCn
              : section.semesterId === previous.id
                ? previous.nameCn
                : locale === "zh-cn"
                  ? "暂无"
                  : "N/A",
          );
        }
      }
      const courseResponse = await page.request.get(
        `/api/catalog/courses/${fixture.course.jwId}`,
      );
      expect(courseResponse.status()).toBe(200);
      const coursePayload = await courseResponse.json();
      expect(Object.hasOwn(coursePayload, "semester")).toBe(false);
      expect(Object.hasOwn(coursePayload, "semesterId")).toBe(false);
      await page
        .context()
        .addCookies([await createSignedSessionCookie(fixture.user.id)]);
      await gotoAndWaitForReady(page, "/workspace/subscriptions");
      await page
        .getByRole("button", { name: /批量添加订阅|Bulk Add Subscriptions/i })
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
        const field = dialog
          .locator('[data-slot="field"]')
          .filter({ has: page.locator(`#bulk-import-section-${section.id}`) });
        await expect(field).toContainText(name);
        await expect(field).toContainText(section.code);
        await expect(field).toContainText(current.nameCn);
      }
      await dialog
        .getByRole("button", {
          name: /订阅已选的 2 个教学班|Subscribe to 2 sections/,
        })
        .click();
      await expect(dialog).toBeHidden();
      for (const section of sections.slice(0, 2)) {
        await expect(
          page
            .locator(`a[href="/catalog/sections/${section.jwId}"]`)
            .filter({ visible: true })
            .first(),
        ).toContainText(name);
      }
      await withE2ePrisma((db) =>
        db.userSectionSubscription.deleteMany({
          where: { userId: fixture.user.id },
        }),
      );
    }
  } finally {
    await withE2ePrisma((db) =>
      db.section.deleteMany({
        where: { id: { in: sections.map((section) => section.id) } },
      }),
    );
    await cleanup(fixture);
  }
});
