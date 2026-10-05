import { expect } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  createPastSemesterFixture,
  prepareSemesterObservation,
  test,
  verifySemesterMatch,
} from "./semester-presentation-fixture";

for (const [domain, method] of [
  ["Overview", "Web"],
  ["Young", "Web"],
  ["Young", "REST"],
] as const) {
  test(
    `cases.semester.no-current-semester-1 ${domain} ${method}`,
    { tag: `@${domain}/${method}` },
    async ({ page, isolatedWorker, calendarProtocolRun }, testInfo) => {
      await calendarProtocolRun(async (io) => {
        const marker = `semester-policy-${crypto.randomUUID()}`;
        const fixture = await isolatedWorker.database.owner.$transaction((db) =>
          createPastSemesterFixture(db, {
            marker,
            name: "Semester policy user",
            activity: true,
          }),
        );
        const observation = await prepareSemesterObservation(
          page,
          isolatedWorker,
          io,
          fixture.user.id,
          [],
        );
        // No fixture semester covers this explicit snapshot date.
        const snapshot =
          "/workspace/overview?snapshotAt=2030-01-01T00:00:00%2B08:00";
        for (const locale of ["en-us", "zh-cn"]) {
          expect(
            (
              await page.request.post("/api/account/preferences", {
                data: { locale },
              })
            ).status(),
          ).toBe(200);
          if (domain === "Overview") {
            await gotoAndWaitForReady(page, snapshot);
            if (locale === "en-us")
              await page.screenshot({
                path: testInfo.outputPath("no-semester-after.png"),
                fullPage: true,
              });
            await expect(page.locator("#main-content")).toContainText(
              locale === "en-us"
                ? "Current semester is unavailable."
                : "暂无当前学期信息。",
            );
            expect(
              await page.locator("#main-content").innerText(),
            ).not.toContain(
              locale === "en-us"
                ? "You only have past-term section subscriptions."
                : "你目前只订阅了往期教学班",
            );
            const todoLink = page
              .locator('#main-content a[href="/workspace/todos"]')
              .first();
            await expect(todoLink).toBeVisible();
            await todoLink.click();
            await expect(page.locator("#main-content")).toContainText(marker);
            await gotoAndWaitForReady(page, snapshot);
            await page
              .getByRole("link", { name: /View Past Homework|查看往期作业/ })
              .click();
            await expect(page.locator("#main-content")).toContainText(
              DEV_SEED.homeworks.historicalTitle,
            );
          }
          if (domain === "Young" && method === "Web") {
            await gotoAndWaitForReady(
              page,
              "/workspace/subscriptions/activities",
            );
            await expect(page.locator("#main-content")).toContainText(
              DEV_SEED.youngEvent.name,
            );
          }
          if (method === "REST") {
            const activities = await page.request.get(
              "/api/workspace/young-event-subscriptions",
            );
            expect(activities.status()).toBe(200);
            expect(JSON.stringify(await activities.json())).toContain(
              DEV_SEED.youngEvent.youngId,
            );
          }
        }
        return observation.checks({
          feedTokenCreated: false,
          requests: [["POST", "/api/account/preferences", [200, 200]]],
        });
      });
    },
  );
}
for (const domain of ["Overview", "Subscription"] as const) {
  test(`cases.semester.no-current-semester-2 ${domain}`, {
    tag: `@${domain}/Web`,
  }, async ({ page, isolatedWorker, calendarProtocolRun }) => {
    await calendarProtocolRun(async (io) => {
      const marker = `semester-import-${crypto.randomUUID()}`;
      const fixture = await isolatedWorker.database.owner.$transaction((db) =>
        createPastSemesterFixture(db, {
          marker,
          name: "Semester import user",
          activity: false,
        }),
      );
      const observation = await prepareSemesterObservation(
        page,
        isolatedWorker,
        io,
        fixture.user.id,
        [],
      );
      for (const locale of ["en-us", "zh-cn"]) {
        expect(
          (
            await page.request.post("/api/account/preferences", {
              data: { locale },
            })
          ).status(),
        ).toBe(200);
        if (domain === "Overview") {
          await gotoAndWaitForReady(
            page,
            "/workspace/overview?snapshotAt=2030-01-01T00:00:00%2B08:00",
          );
          await expect(
            page.getByRole("link", {
              name: /Browse Courses|浏览课程/,
              exact: true,
            }),
          ).toHaveAttribute("href", "/catalog/courses");
          await expect(
            page.getByRole("link", {
              name: /Browse Sections|浏览班级/,
              exact: true,
            }),
          ).toHaveAttribute("href", "/catalog/sections");
          await page
            .getByRole("link", {
              name: /View Past Sections|查看往期班级/,
              exact: true,
            })
            .click();
          await expect(page).toHaveURL(/\/workspace\/subscriptions$/);
        }
        if (domain === "Subscription") {
          await gotoAndWaitForReady(
            page,
            "/workspace/subscriptions?snapshotAt=2030-01-01T00:00:00%2B08:00",
          );
          await expect(
            page
              .locator(
                `#main-content a[href="/catalog/sections/${DEV_SEED.previousSection.jwId}"]`,
              )
              .filter({ visible: true })
              .first(),
          ).toBeVisible();
          await page
            .getByRole("button", {
              name: /Bulk Add Subscriptions|批量添加订阅/,
            })
            .click();
          await expect(page.locator("#bulk-import-semester")).toHaveValue("");
          await page
            .locator("#bulk-import-section-codes")
            .fill(fixture.section.code);
          const match = page.getByRole("button", {
            name: /Match Sections|识别并匹配课程/,
          });
          await expect(match).toBeDisabled();
          await page
            .locator("#bulk-import-semester")
            .selectOption(String(fixture.section.semesterId));
          await expect(match).toBeEnabled();
          await match.click();
          const dialog = page.getByRole("dialog", {
            name: /Confirm .*section subscriptions?|确认订阅/,
          });
          await expect(dialog).toContainText(fixture.section.code);
          await expect(dialog).toContainText(
            locale === "en-us" ? "Fall 2025" : DEV_SEED.previousSemesterNameCn,
          );
          await page.keyboard.press("Escape");
        }
      }
      return observation.checks({
        feedTokenCreated: true,
        requests: [
          ["POST", "/api/account/preferences", [200, 200]],
          [
            "POST",
            "/api/workspace/subscriptions/query",
            domain === "Subscription" ? [200, 200] : [],
          ],
        ],
      });
    }, verifySemesterMatch);
  });
}
for (const domain of ["Overview", "Subscription"] as const) {
  test(`cases.semester.only-non-current-semester-subscriptions-1 ${domain}`, {
    tag: `@${domain}/Web`,
  }, async ({ page, isolatedWorker, calendarProtocolRun }) => {
    await calendarProtocolRun(async (io) => {
      const marker = `past-term-${crypto.randomUUID()}`;
      const fixture = await isolatedWorker.database.owner.$transaction((db) =>
        createPastSemesterFixture(db, {
          marker,
          name: "Past term user",
          activity: false,
        }),
      );
      const observation = await prepareSemesterObservation(
        page,
        isolatedWorker,
        io,
        fixture.user.id,
        [],
      );
      for (const locale of ["en-us", "zh-cn"]) {
        expect(
          (
            await page.request.post("/api/account/preferences", {
              data: { locale },
            })
          ).status(),
        ).toBe(200);
        if (domain === "Overview") {
          await gotoAndWaitForReady(
            page,
            "/workspace/overview?snapshotAt=2026-04-29T08:00:00%2B08:00",
          );
          await expect(
            page.getByRole("heading", {
              name:
                locale === "en-us"
                  ? "No current-term section subscriptions"
                  : "当前学期暂无教学班订阅",
              exact: true,
            }),
          ).toBeVisible();
          await expect(page.locator("#main-content")).toContainText(
            locale === "en-us"
              ? "You only have past-term section subscriptions."
              : "你目前只订阅了往期教学班。",
          );
          expect(await page.locator("#main-content").innerText()).not.toContain(
            locale === "en-us"
              ? "Current semester is unavailable."
              : "暂无当前学期信息。",
          );
          await page
            .getByRole("link", { name: /View Past Homework|查看往期作业/ })
            .click();
          const homework = page
            .getByRole("row")
            .filter({ hasText: DEV_SEED.homeworks.historicalTitle });
          await expect(homework).toContainText(
            locale === "en-us" ? "Fall 2025" : DEV_SEED.previousSemesterNameCn,
          );
          expect(await homework.innerText()).not.toContain(
            DEV_SEED.semesterNameCn,
          );
        }
        if (domain === "Subscription") {
          await gotoAndWaitForReady(page, "/workspace/subscriptions");
          await expect(page.locator("#main-content")).toContainText(
            locale === "en-us" ? "Fall 2025" : DEV_SEED.previousSemesterNameCn,
          );
          await expect(
            page
              .getByTestId("subscription-course-link")
              .filter({ visible: true }),
          ).toHaveCount(1);
        }
      }
      return observation.checks({
        feedTokenCreated: domain === "Subscription",
        requests: [["POST", "/api/account/preferences", [200, 200]]],
      });
    });
  });
}
