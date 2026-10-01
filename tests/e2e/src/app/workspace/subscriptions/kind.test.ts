import { expect, type Page } from "@playwright/test";
import { test } from "../../../../utils/homework-fixture";

async function openKindDialog(page: Page, jwId: number, width: number) {
  const row = page
    .locator(width < 768 ? '[data-slot="item"]' : "tr")
    .filter({ has: page.locator(`a[href="/catalog/sections/${jwId}"]`) })
    .filter({ visible: true })
    .first();
  await row.getByRole("button", { name: /订阅身份|Subscription role/ }).click();
  const dialog = page.getByRole("dialog", {
    name: /订阅身份|Subscription role/,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function expectResponsivePage(page: Page, errors: string[]) {
  expect(errors).toEqual([]);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((body) => body.clientWidth),
  );
}

test.describe.configure({ mode: "parallel" });

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  for (const action of ["save", "cancel", "failed save"] as const) {
    test(`subscription kind ${action} (${viewport.width}px)`, async ({
      page,
      academic,
      account,
      homeworkRun,
      academicDb,
    }, testInfo) => {
      const where = {
        userId_sectionId: {
          userId: account.id,
          sectionId: academic.section.id,
        },
      };
      // Each case prepares its own persisted role before observation starts.
      const before = await academicDb((db) =>
        db.userSectionSubscription.update({
          where,
          data: { kind: action === "save" ? "regular" : "teaching_assistant" },
        }),
      );
      await homeworkRun(
        async () => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.setViewportSize(viewport);
          await page.goto("/workspace/subscriptions");
          const dialog = await openKindDialog(
            page,
            academic.section.jwId,
            viewport.width,
          );
          await dialog
            .getByRole("radio", {
              name:
                action === "save" ? /助教|Teaching assistant/ : /旁听|Auditor/,
            })
            .click();
          if (action === "save") {
            await page.screenshot({
              path: testInfo.outputPath("subscription-kind-dialog.png"),
            });
            await dialog.getByRole("button", { name: /^(保存|Save)$/ }).click();
            await expect(dialog).toBeHidden();
          } else {
            if (action === "failed save") {
              await page.route(
                `**/api/workspace/subscriptions/${academic.section.jwId}`,
                (route) =>
                  route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({
                      error: "Save temporarily unavailable",
                    }),
                  }),
                { times: 1 },
              );
              await dialog
                .getByRole("button", { name: /^(保存|Save)$/ })
                .click();
              await expect(
                dialog.getByText("Save temporarily unavailable"),
              ).toBeVisible();
              await expect(
                dialog.getByRole("radio", { name: /旁听|Auditor/ }),
              ).toHaveAttribute("data-state", "on");
            }
            await dialog
              .getByRole("button", { name: /^(取消|Cancel)$/ })
              .click();
            await expect(dialog).toBeHidden();
          }
          const response = await page.request.get(
            "/api/workspace/subscriptions/current",
          );
          expect(response.status()).toBe(200);
          const body = await response.json();
          expect(
            body.subscription.sections.find(
              (section: { jwId: number }) =>
                section.jwId === academic.section.jwId,
            ).kind,
          ).toBe("teaching_assistant");
          expect(
            await academicDb((db) =>
              db.userSectionSubscription.findUnique({ where }),
            ),
          ).toEqual({ ...before, kind: "teaching_assistant" });
          await page.reload();
          await openKindDialog(page, academic.section.jwId, viewport.width);
          await expect(
            dialog.getByRole("radio", { name: /助教|Teaching assistant/ }),
          ).toHaveAttribute("data-state", "on");
          await expectResponsivePage(page, errors);
        },
        {
          calendarMessages:
            action === "save" ? [{ type: "user", userId: account.id }] : [],
          calendarTokenCreated: true,
        },
      );
    });
  }

  test(`teaching assistant homework status consumes a seeded role (${viewport.width}px)`, async ({
    page,
    academic,
    homeworks,
    account,
    homeworkRun,
    academicDb,
  }, testInfo) => {
    const where = {
      userId_sectionId: { userId: account.id, sectionId: academic.section.id },
    };
    const before = await academicDb((db) =>
      db.userSectionSubscription.update({
        where,
        data: { kind: "teaching_assistant" },
      }),
    );
    await homeworkRun(
      async () => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize(viewport);
        await page.goto("/workspace/homeworks");
        await page
          .getByRole("radio", { name: /全部|All/i })
          .first()
          .click();
        for (const title of [homeworks[0].title, homeworks[1].title]) {
          const homework = page
            .locator(viewport.width < 768 ? '[data-slot="item"]' : "tr")
            .filter({ hasText: title })
            .filter({ visible: true })
            .first();
          await expect(homework).toBeVisible();
          await expect(
            homework.getByText(/无需完成|No completion required/),
          ).toBeVisible();
        }
        expect(
          await academicDb((db) =>
            db.userSectionSubscription.findUnique({ where }),
          ),
        ).toEqual(before);
        await page.screenshot({
          path: testInfo.outputPath("ta-homework-status.png"),
        });
        await expectResponsivePage(page, errors);
      },
      { calendarMessages: [] },
    );
  });
}
