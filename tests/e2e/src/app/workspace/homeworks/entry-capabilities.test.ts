import { expect } from "@playwright/test";
import { createHomeworkAcademic } from "../../../../utils/homework-state";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/personal-preferences-fixture";

for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  test(
    `suspended homework capabilities agree across entrances ${locale} ${width}`,
    { tag: "@Homework/Web" },
    async ({ page, account, isolatedWorker, preferenceFlow }, info) => {
      const db = isolatedWorker.database.owner;
      const fixture = await preferenceFlow.prepare(async () => {
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
        await db.course.update({
          where: { id: academic.course.id },
          data: {
            nameCn: "独立作业验收课程",
            nameEn: "Isolated homework acceptance course",
            code: "HW1432",
          },
        });
        await db.section.update({
          where: { id: academic.section.id },
          data: { code: "HW1432.01" },
        });
        const homework = await db.homework.create({
          data: {
            sectionId: academic.section.id,
            createdById: account.id,
            title: "Read-only homework / 只读作业",
            submissionDueAt: new Date("2020-01-01"),
          },
        });
        await db.userSuspension.create({
          data: { userId: account.id, reason: "Isolated read-only viewer" },
        });
        return { ...academic, homework };
      });
      const state = async () => ({
        homeworks: await db.homework.findMany({
          where: { sectionId: fixture.section.id },
        }),
        completions: await db.homeworkCompletion.findMany({
          where: { homeworkId: fixture.homework.id },
        }),
        audits: await db.auditLog.findMany({
          where: { targetId: fixture.homework.id },
        }),
      });
      const before = await state();
      await preferenceFlow.run(async () => {
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(page, "/workspace/homeworks");
        await page
          .getByRole("button", { name: fixture.homework.title, exact: true })
          .filter({ visible: true })
          .click();
        const workspace = page.getByRole("dialog", {
          name: fixture.homework.title,
          exact: true,
        });
        await expect(workspace).toBeVisible();
        await expect(workspace.locator('[data-slot="skeleton"]')).toHaveCount(
          0,
        );
        await page.evaluate(() => document.fonts.ready);
        await info.attach(`workspace-${locale}-${width}`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });
        const workspaceCount = await workspace
          .getByRole("button", { name: /Mark as complete|标记为完成/ })
          .count();
        await page.keyboard.press("Escape");
        const add = page.getByTestId("workspace-homeworks-add");
        const addDisabled = await add.isDisabled();
        // Suspension forbids shared-content creation; personal completion is separately permitted by homework.completion-owner.
        const response = await preferenceFlow.http(() =>
          page.request.post("/workspace?/createHomework", {
            headers: {
              ...preferenceFlow.headers,
              Origin: isolatedWorker.origin,
            },
            form: {
              title: "Forbidden shared write",
              sectionId: String(fixture.section.id),
            },
          }),
        );
        expect(response.status()).toBe(403);
        await response.body();
        await gotoAndWaitForReady(
          page,
          `/catalog/sections/${fixture.section.jwId}#homework`,
        );
        await page
          .getByTestId("section-homeworks-list")
          .getByRole("button", { name: fixture.homework.title, exact: true })
          .filter({ visible: true })
          .click();
        const section = page.getByRole("dialog", {
          name: fixture.homework.title,
          exact: true,
        });
        await expect(section).toBeVisible();
        await expect(section.locator('[data-slot="skeleton"]')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        await info.attach(`section-${locale}-${width}`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });
        const sectionCount = await section
          .getByRole("button", { name: /Mark as complete|标记为完成/ })
          .count();
        expect(await state()).toEqual(before);
        expect(
          workspaceCount,
          "Personal completion remains allowed for its suspended owner",
        ).toBe(1);
        expect(
          sectionCount,
          "Section must retain the same personal completion capability",
        ).toBe(1);
        expect(addDisabled, "Suspended workspace cannot create homework").toBe(
          true,
        );
      });
    },
  );
}

for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  test(
    `homework create shortcuts and history agree across entrances ${locale} ${width}`,
    { tag: "@Homework/Web" },
    async ({ page, account, isolatedWorker, preferenceFlow }, info) => {
      const fixture = await preferenceFlow.prepare(async () => {
        const semester = await isolatedWorker.database.owner.semester.create({
          data: {
            jwId: 987654,
            code: "421",
            nameCn: "2020年春季学期",
            startDate: new Date("2020-01-01"),
            endDate: new Date("2020-06-30"),
          },
        });
        const academic = await createHomeworkAcademic(
          isolatedWorker.database.owner,
          account.id,
          semester.id,
        );
        await isolatedWorker.database.owner.course.update({
          where: { id: academic.course.id },
          data: {
            nameCn: "独立作业验收课程",
            nameEn: "Isolated homework acceptance course",
            code: "HW1432",
          },
        });
        await isolatedWorker.database.owner.section.update({
          where: { id: academic.section.id },
          data: { code: "HW1432.01" },
        });
        const homework = await isolatedWorker.database.owner.homework.create({
          data: {
            sectionId: academic.section.id,
            createdById: account.id,
            title: "Historical semester homework",
            submissionDueAt: new Date("2020-06-30T12:00:00+08:00"),
          },
        });
        await isolatedWorker.database.owner.auditLog.create({
          data: {
            action: "homework_create",
            userId: account.id,
            subjectUserId: account.id,
            targetId: homework.id,
            targetType: "homework",
            metadata: {
              sectionId: academic.section.id,
              titleSnapshot: homework.title,
            },
          },
        });
        return { ...academic, homework };
      });
      await preferenceFlow.run(async () => {
        await page.clock.setFixedTime(new Date("2026-11-07T04:00:00Z"));
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(page, "/workspace/homeworks");
        await page.getByTestId("workspace-homeworks-add").click();
        let dialog = page.getByRole("dialog");
        await dialog
          .locator('select[name="sectionId"]')
          .selectOption(String(fixture.section.id));
        await expect(dialog.getByRole("status")).toHaveCount(0);
        await dialog
          .getByRole("button", {
            name: locale === "en-us" ? "Common deadlines" : "常用截止时间",
            exact: true,
          })
          .click();
        const semesterEnd = () =>
          page.getByRole("menuitem", {
            name:
              locale === "en-us" ? "Due before semester end" : "学期末前提交",
            exact: true,
          });
        const workspaceDefaults = await dialog
          .locator(
            'input[name="publishedAt"],input[name="submissionStartAt"],input[name="submissionDueAt"]',
          )
          .evaluateAll((inputs) =>
            inputs.map((input) => ({
              name: input.getAttribute("name"),
              value: (input as HTMLInputElement).value,
            })),
          );
        const workspaceDisabled = await semesterEnd().isDisabled();
        await info.attach(`workspace-create-${locale}-${width}`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await gotoAndWaitForReady(
          page,
          `/catalog/sections/${fixture.section.jwId}#homework`,
        );
        await page
          .locator("#homework")
          .getByRole("button", {
            name: locale === "en-us" ? "Create" : "新建",
            exact: true,
          })
          .click();
        dialog = page.getByRole("dialog");
        const audit = dialog.getByRole("button", {
          name: locale === "en-us" ? "Edit records" : "编辑记录",
          exact: true,
        });
        const auditInCreate = await audit.count();
        await expect(dialog.getByRole("status")).toHaveCount(0);
        await dialog
          .getByRole("button", {
            name: locale === "en-us" ? "Common deadlines" : "常用截止时间",
            exact: true,
          })
          .click();
        const sectionDefaults = await dialog
          .locator(
            'input[name="publishedAt"],input[name="submissionStartAt"],input[name="submissionDueAt"]',
          )
          .evaluateAll((inputs) =>
            inputs.map((input) => ({
              name: input.getAttribute("name"),
              value: (input as HTMLInputElement).value,
            })),
          );
        expect(sectionDefaults).toEqual(workspaceDefaults);
        const sectionDisabled = await semesterEnd().isDisabled();
        await info.attach(`section-create-${locale}-${width}`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });
        expect(workspaceDisabled).toBe(true);
        expect(
          sectionDisabled,
          "Same past semester must have the same shortcut policy",
        ).toBe(true);
        expect(auditInCreate, "New objects do not have edit history").toBe(0);
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        const collectionHistory = page
          .locator("#homework")
          .getByRole("button", {
            name: locale === "en-us" ? "Edit records" : "编辑记录",
            exact: true,
          });
        if (width === 390) {
          const bounds = await collectionHistory.boundingBox();
          expect(bounds?.height).toBeGreaterThanOrEqual(44);
          expect(bounds?.width).toBeGreaterThanOrEqual(44);
        }
        await collectionHistory.click();
        await expect(
          page
            .getByRole("dialog")
            .getByText(fixture.homework.title, { exact: true }),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await page
          .getByTestId("section-homeworks-list")
          .getByRole("button", { name: fixture.homework.title, exact: true })
          .filter({ visible: true })
          .click();
        dialog = page.getByRole("dialog", {
          name: fixture.homework.title,
          exact: true,
        });
        await dialog
          .getByRole("button", {
            name: locale === "en-us" ? "More details" : "更多信息",
            exact: true,
          })
          .click();
        await page
          .getByRole("menuitem", {
            name: locale === "en-us" ? "Edit details" : "编辑信息",
            exact: true,
          })
          .click();
        await expect(dialog.getByRole("status")).toHaveCount(0);
        await dialog
          .getByRole("button", {
            name: locale === "en-us" ? "Common deadlines" : "常用截止时间",
            exact: true,
          })
          .click();
        await expect(semesterEnd()).toBeDisabled();
        await page.keyboard.press("Escape");
        // A past-semester suggestion is disabled, but manually entered historical values remain editable.
        await dialog
          .locator('input[name="submissionDueAt"]')
          .fill("2020-05-20T12:00");
        await expect(
          dialog.locator('input[name="submissionDueAt"]'),
        ).toHaveValue("2020-05-20T12:00");
      });
    },
  );
}

test("homework class shortcuts refresh after a long-lived workspace", {
  tag: "@Homework/Web",
}, async ({ page, account, isolatedWorker, preferenceFlow }) => {
  const db = isolatedWorker.database.owner;
  const dates = [1, 2, 3, 4].map((days) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10),
  );
  const fixture = await preferenceFlow.prepare(async () => {
    const semester = await db.semester.create({
      data: {
        jwId: 987654,
        code: "421",
        nameCn: "独立学期",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2099-12-31"),
      },
    });
    const academic = await createHomeworkAcademic(db, account.id, semester.id);
    const group = await db.scheduleGroup.create({
      data: {
        sectionId: academic.section.id,
        jwId: 1500000005,
        no: 1,
        limitCount: 30,
        stdCount: 1,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    for (const date of dates)
      await db.schedule.create({
        data: {
          sectionId: academic.section.id,
          scheduleGroupId: group.id,
          date: new Date(`${date}T00:00:00Z`),
          weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
          startTime: 800,
          endTime: 945,
          startUnit: 1,
          endUnit: 2,
          periods: 2,
          weekIndex: 1,
        },
      });
    return academic;
  });
  await preferenceFlow.run(async () => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await gotoAndWaitForReady(page, "/workspace/homeworks");
    // Only the Date clock advances: timers, networking and the native owner remain real.
    await page.clock.setFixedTime(new Date(`${dates[2]}T09:00:00+08:00`));
    await page.getByTestId("workspace-homeworks-add").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Common deadlines", exact: true })
      .click();
    await expect(
      page.getByRole("menuitem").filter({ hasText: /Next class/ }),
    ).toHaveCount(1);
    const workspaceStarts = await page
      .getByRole("menuitem")
      .filter({ hasText: /Next class/ })
      .allTextContents();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await gotoAndWaitForReady(
      page,
      `/catalog/sections/${fixture.section.jwId}#homework`,
    );
    await page
      .locator("#homework")
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Common deadlines", exact: true })
      .click();
    await expect(
      page.getByRole("menuitem").filter({ hasText: /Next class/ }),
    ).toHaveCount(1);
    const sectionStarts = await page
      .getByRole("menuitem")
      .filter({ hasText: /Next class/ })
      .allTextContents();
    expect(sectionStarts).toHaveLength(1);
    expect(
      workspaceStarts,
      "Opening later must not lose the fourth actual schedule",
    ).toEqual(sectionStarts);
  });
});

test("fresh class deadline failure and cancellation preserve the current draft", {
  tag: "@Homework/Web",
}, async ({ page, account, isolatedWorker, preferenceFlow }) => {
  const db = isolatedWorker.database.owner;
  const fixture = await preferenceFlow.prepare(async () => {
    const semester = await db.semester.create({
      data: {
        jwId: 987654,
        code: "421",
        nameCn: "独立学期",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2099-12-31"),
      },
    });
    const first = await createHomeworkAcademic(db, account.id, semester.id);
    const second = await createHomeworkAcademic(db, account.id, semester.id);
    const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    for (const [index, academic] of [first, second].entries()) {
      const group = await db.scheduleGroup.create({
        data: {
          sectionId: academic.section.id,
          jwId: 1500000005 + index,
          no: 1,
          limitCount: 30,
          stdCount: 1,
          actualPeriods: 2,
          isDefault: true,
        },
      });
      await db.schedule.create({
        data: {
          sectionId: academic.section.id,
          scheduleGroupId: group.id,
          date: new Date(`${date}T00:00:00Z`),
          weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
          startTime: index === 0 ? 800 : 1400,
          endTime: 1500,
          startUnit: 1,
          endUnit: 2,
          periods: 2,
          weekIndex: 1,
        },
      });
    }
    return { first, second };
  });
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  preferenceFlow.onClosing(release);
  let releaseClose = () => {};
  const heldClose = new Promise<void>((resolve) => {
    releaseClose = resolve;
  });
  preferenceFlow.onClosing(releaseClose);
  let attempts = 0;
  await preferenceFlow.route(
    page,
    (url) =>
      url.pathname ===
      `/api/catalog/sections/${fixture.first.section.jwId}/schedules`,
    async (route) => {
      attempts += 1;
      if (attempts === 1)
        return route.fulfill({
          status: 503,
          body: "Isolated class deadlines unavailable",
        });
      if (attempts === 2) await held;
      if (attempts === 3) await heldClose;
      await route.fallback();
    },
  );
  await preferenceFlow.run(async () => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page.setViewportSize({ width: 390, height: 900 });
    await gotoAndWaitForReady(page, "/workspace/homeworks");
    await page.getByTestId("workspace-homeworks-add").click();
    const dialog = page.getByRole("dialog", {
      name: "New Homework",
      exact: true,
    });
    const select = dialog.locator('select[name="sectionId"]');
    await select.selectOption(String(fixture.first.section.id));
    await dialog.locator('input[name="title"]').fill("Preserved draft title");
    await dialog
      .locator('input[name="submissionDueAt"]')
      .fill("2099-01-20T12:34");
    const retry = dialog.getByRole("button", {
      name: "Retry class deadlines",
      exact: true,
    });
    await expect(retry).toBeVisible();
    const retryBounds = await retry.boundingBox();
    expect(retryBounds?.height).toBeGreaterThanOrEqual(44);
    expect(retryBounds?.width).toBeGreaterThanOrEqual(44);
    const admission = preferenceFlow.waitForRequest(
      page.context(),
      (request) =>
        new URL(request.url()).pathname ===
        `/api/catalog/sections/${fixture.first.section.jwId}/schedules`,
    );
    await retry.click();
    const oldRequest = await admission;
    await expect(dialog.getByRole("status")).toHaveText(
      "Loading class deadlines…",
    );
    preferenceFlow.expectReadCancellation(page, oldRequest);
    await select.selectOption(String(fixture.second.section.id));
    release();
    await expect(dialog.getByRole("status")).toHaveCount(0);
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.locator('input[name="title"]')).toHaveValue(
      "Preserved draft title",
    );
    await expect(dialog.locator('input[name="submissionDueAt"]')).toHaveValue(
      "2099-01-20T12:34",
    );
    await dialog
      .getByRole("button", { name: "Common deadlines", exact: true })
      .click();
    await expect(
      page.getByRole("menuitem").filter({ hasText: /Next class/ }),
    ).toHaveText(/2:00 PM/);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    const closingAdmission = preferenceFlow.waitForRequest(
      page.context(),
      (request) =>
        new URL(request.url()).pathname ===
        `/api/catalog/sections/${fixture.first.section.jwId}/schedules`,
    );
    await page.getByTestId("workspace-homeworks-add").click();
    await page
      .getByRole("dialog")
      .locator('select[name="sectionId"]')
      .selectOption(String(fixture.first.section.id));
    const closingRequest = await closingAdmission;
    preferenceFlow.expectReadCancellation(page, closingRequest);
    await page.keyboard.press("Escape");
    releaseClose();
    await expect(dialog).toHaveCount(0);
    await page.getByTestId("workspace-homeworks-add").click();
    await page
      .getByRole("dialog")
      .locator('select[name="sectionId"]')
      .selectOption(String(fixture.first.section.id));
    await expect(page.getByRole("dialog").getByRole("status")).toHaveCount(0);
    await expect(
      page.getByRole("dialog").locator('input[name="title"]'),
    ).toHaveValue("");
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveCount(0);
    await page.keyboard.press("Escape");
    expect(
      await db.homework.count({
        where: {
          sectionId: {
            in: [fixture.first.section.id, fixture.second.section.id],
          },
        },
      }),
    ).toBe(0);
  });
});

test("class deadline reads continue past full pages of elapsed and duplicate schedules", {
  tag: "@Homework/Web",
}, async ({ page, account, isolatedWorker, preferenceFlow }) => {
  const db = isolatedWorker.database.owner;
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const fixture = await preferenceFlow.prepare(async () => {
    const semester = await db.semester.create({
      data: {
        jwId: 987654,
        code: "421",
        nameCn: "独立学期",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2099-12-31"),
      },
    });
    const academic = await createHomeworkAcademic(db, account.id, semester.id);
    const group = await db.scheduleGroup.create({
      data: {
        sectionId: academic.section.id,
        jwId: 1500000005,
        no: 1,
        limitCount: 30,
        stdCount: 1,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    await db.schedule.createMany({
      data: [
        ...Array.from({ length: 100 }, () => 800),
        ...Array.from({ length: 100 }, () => 1300),
        1400,
        1500,
      ].map((startTime) => ({
        sectionId: academic.section.id,
        scheduleGroupId: group.id,
        date: new Date(`${date}T00:00:00Z`),
        weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
        startTime,
        endTime: 1600,
        startUnit: 1,
        endUnit: 2,
        periods: 2,
        weekIndex: 1,
      })),
    });
    return academic;
  });
  await preferenceFlow.run(async () => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await gotoAndWaitForReady(page, "/workspace/homeworks");
    await page.clock.setFixedTime(new Date(`${date}T12:00:00+08:00`));
    const pages: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname ===
        `/api/catalog/sections/${fixture.section.jwId}/schedules`
      )
        pages.push(url.searchParams.get("page") ?? "");
    });
    for (const entrance of ["workspace", "section"]) {
      if (entrance === "workspace")
        await page.getByTestId("workspace-homeworks-add").click();
      else {
        await gotoAndWaitForReady(
          page,
          `/catalog/sections/${fixture.section.jwId}#homework`,
        );
        await page
          .locator("#homework")
          .getByRole("button", { name: "Create", exact: true })
          .click();
      }
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("status")).toHaveCount(0);
      await dialog
        .getByRole("button", { name: "Common deadlines", exact: true })
        .click();
      const starts = page
        .getByRole("menuitem")
        .filter({ hasText: /Next class/ });
      await expect(starts).toHaveCount(3);
      await expect(starts).toHaveText([/1:00 PM/, /2:00 PM/, /3:00 PM/]);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
    }
    expect(pages).toEqual(["1", "2", "3", "1", "2", "3"]);
    expect(
      await db.homework.count({ where: { sectionId: fixture.section.id } }),
    ).toBe(0);
  });
});
