import { expect } from "@playwright/test";
import { test } from "../../../../utils/homework-fixture";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "parallel" });

  test("可以创建新作业", async ({
    page,
    academic,
    account,
    homeworkRun,
    storedHomeworks,
  }) => {
    await homeworkRun(
      async () => {
        test.setTimeout(60_000);
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        const addButton = page.getByTestId("workspace-homeworks-add").first();
        const title = `e2e-workspace-homework-${crypto.randomUUID()}`;
        const titleInput = page.getByTestId("workspace-homework-title");
        await expect(async () => {
          await expect(addButton).toBeVisible({ timeout: 3_000 });
          await addButton.click();
          await expect(titleInput).toBeVisible({ timeout: 3_000 });
        }).toPass({
          timeout: 10_000,
          intervals: [250, 500, 1_000],
        });
        const createDialog = page
          .locator('[data-slot="dialog-content"]')
          .first();
        await expect(
          createDialog.getByRole("group", { name: /说明|Details/i }),
        ).toBeVisible();
        await expect(
          createDialog.getByRole("group", {
            name: /提交截止|Submission due/i,
          }),
        ).toBeVisible();
        await titleInput.fill(title);

        let releaseCreateRequest: (() => void) | undefined;
        const createRequestHeld = new Promise<void>((resolve) => {
          releaseCreateRequest = resolve;
        });
        let createRequestIntercepted = false;
        let resolveCreateRouteHandled: (() => void) | undefined;
        const createRouteHandled = new Promise<void>((resolve) => {
          resolveCreateRouteHandled = resolve;
        });
        const createRoutePattern = "**/workspace/homeworks**";
        await page.route(createRoutePattern, async (route) => {
          if (
            route.request().method() !== "POST" ||
            !route.request().url().includes("createHomework")
          ) {
            await route.fallback();
            return;
          }
          createRequestIntercepted = true;
          await createRequestHeld;
          try {
            await route.fallback();
          } finally {
            resolveCreateRouteHandled?.();
          }
        });
        try {
          const createButton = page.getByTestId("workspace-homework-create");
          await createButton.click();
          await expect(titleInput).toBeDisabled();
          await expect(
            createDialog.locator('select[name="sectionId"]'),
          ).toBeDisabled();
          await expect(createButton).toBeDisabled();
        } finally {
          releaseCreateRequest?.();
          if (createRequestIntercepted) await createRouteHandled;
          await page.unroute(createRoutePattern);
        }

        await expect(visibleText(page, title)).toBeVisible({
          timeout: 15_000,
        });
        const stored = await storedHomeworks(academic.section.id);
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({
          title,
          sectionId: academic.section.id,
          createdById: account.id,
          isMajor: false,
          requiresTeam: false,
        });
      },
      {
        calendarMessages: [{ type: "section", sectionId: academic.section.id }],
        calendarTokenCreated: false,
        auditActions: { homework_create: 1 },
      },
    );
  });

  test("homework.workspace-style-guide-omitted", async ({
    page,
    academic: _academic,
    homeworkRun,
  }) => {
    await homeworkRun(
      async () => {
        const localeResponse = await page.request.post(
          "/api/account/preferences",
          {
            data: { locale: "en-us" },
          },
        );
        expect(localeResponse.status()).toBe(200);
        await localeResponse.body();
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        await page.getByTestId("workspace-homeworks-add").first().click();
        const createDialog = page
          .locator('[data-slot="dialog-content"]')
          .first();
        const titleInput = createDialog.getByTestId("workspace-homework-title");
        await expect(titleInput).toHaveAttribute(
          "placeholder",
          "e.g., 第一次作业 / 期中论文作业",
        );
        await expect(
          createDialog.getByRole("textbox", { name: "Details" }),
        ).toHaveAttribute("placeholder", /题目：/);

        await expect(
          createDialog.getByTestId("workspace-homework-style-guide-trigger"),
        ).toHaveCount(0);
        await expect(
          createDialog.locator('[data-slot="dialog-description"]'),
        ).toHaveCount(0);
        await expect(
          createDialog.getByTestId("workspace-homework-create"),
        ).toBeVisible();
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });

  test("创建作业时可设置重要、组队、截止日期和说明", async ({
    page,
    academic,
    account,
    homeworkRun,
    storedHomeworks,
  }) => {
    await homeworkRun(
      async () => {
        test.setTimeout(60_000);
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        const addButton = page.getByTestId("workspace-homeworks-add").first();
        const title = `e2e-workspace-hw-full-${crypto.randomUUID()}`;
        const description = `e2e-workspace-hw-description-${crypto.randomUUID()}`;
        const dueAt = "2026-12-31T23:59";
        const titleInput = page.getByTestId("workspace-homework-title");
        await expect(async () => {
          await expect(addButton).toBeVisible({ timeout: 3_000 });
          await addButton.click();
          await expect(titleInput).toBeVisible({ timeout: 3_000 });
        }).toPass({
          timeout: 10_000,
          intervals: [250, 500, 1_000],
        });

        const createDialog = page
          .locator('[data-slot="dialog-content"]')
          .first();
        const advancedSettings = createDialog.getByRole("button", {
          name: /其他可选设置|Other optional settings|收起其他可选设置|Hide optional settings/i,
        });
        await expect(advancedSettings).toHaveAttribute(
          "aria-expanded",
          "false",
        );
        await expect(
          createDialog.getByRole("textbox", { name: /发布日期|Published/i }),
        ).toHaveCount(0);
        await advancedSettings.click();
        await expect(
          createDialog.getByRole("textbox", { name: /发布日期|Published/i }),
        ).toBeVisible();
        await titleInput.fill(title);
        await createDialog
          .getByRole("textbox", { name: /Details|说明/i })
          .fill(description);
        await createDialog
          .getByRole("textbox", { name: /Submission due|提交截止/i })
          .fill(dueAt);
        await createDialog
          .getByRole("checkbox", { name: /Major assignment|大作业/i })
          .click();
        await createDialog
          .getByRole("checkbox", { name: /Team required|需要组队/i })
          .click();

        {
          await page.getByTestId("workspace-homework-create").click();
          const row = page.getByRole("row").filter({ hasText: title }).first();
          await expect(row).toBeVisible({ timeout: 15_000 });

          await page.keyboard.press("Escape");
          await expect(
            page.locator('[data-slot="dialog-content"]').first(),
          ).toHaveCount(0, { timeout: 5_000 });

          await expect(row.getByText(/Major assignment|大作业/i)).toBeVisible();
          await expect(row.getByText(/Team required|需要组队/i)).toBeVisible();

          await expect(row).toContainText(
            /2026-12-31|2026\/12\/31|12月31日|Dec 31/,
          );
          await expect(row).toContainText(/23:59|11:59 PM/);

          await row.getByRole("button", { name: new RegExp(title) }).click();
          const detailDialog = page
            .locator('[data-slot="dialog-content"]')
            .first();
          await expect(detailDialog).toBeVisible();
          await expect(detailDialog.getByText(description)).toBeVisible();
          const stored = await storedHomeworks(academic.section.id);
          expect(stored).toHaveLength(1);
          expect(stored[0]).toMatchObject({
            title,
            sectionId: academic.section.id,
            createdById: account.id,
            isMajor: true,
            requiresTeam: true,
            submissionDueAt: new Date("2026-12-31T23:59:00+08:00"),
            description: { content: description, lastEditedById: account.id },
          });
          await expect(detailDialog).toHaveAttribute(
            "data-homework-id",
            stored[0].id,
          );
        }
      },
      {
        calendarMessages: [{ type: "section", sectionId: academic.section.id }],
        calendarTokenCreated: false,
        auditActions: { homework_create: 1 },
      },
    );
  });
});
