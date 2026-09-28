import { expect } from "@playwright/test";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { test } from "../../../../utils/homework-fixture";

test.describe.configure({ mode: "parallel" });

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`edit subscription kind after subscribing (${viewport.width}px)`, async ({
    page,
    academic,
    homeworks,
    account,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    const row = page
      .locator(viewport.width < 768 ? '[data-slot="item"]' : "tr")
      .filter({
        has: page.locator(
          `a[href="/catalog/sections/${academic.section.jwId}"]`,
        ),
      })
      .filter({ visible: true })
      .first();
    const path = `/api/workspace/subscriptions/${academic.section.jwId}`;
    await page.goto("/workspace/subscriptions");
    await row
      .getByRole("button", { name: /订阅身份|Subscription role/ })
      .click();
    const dialog = page.getByRole("dialog", {
      name: /订阅身份|Subscription role/,
    });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("radio", { name: /助教|Teaching assistant/ })
      .click();
    await page.screenshot({
      path: testInfo.outputPath("subscription-kind-dialog.png"),
    });
    await dialog.getByRole("button", { name: /^(保存|Save)$/ }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await row
      .getByRole("button", { name: /订阅身份|Subscription role/ })
      .click();
    await expect(
      dialog.getByRole("radio", { name: /助教|Teaching assistant/ }),
    ).toHaveAttribute("data-state", "on");
    await dialog.getByRole("radio", { name: /旁听|Auditor/ }).click();
    await dialog.getByRole("button", { name: /^(取消|Cancel)$/ }).click();
    const response = await page.request.get(
      "/api/workspace/subscriptions/current",
    );
    const body = await response.json();
    expect(
      body.subscription.sections.find(
        (section: { jwId: number }) => section.jwId === academic.section.jwId,
      ).kind,
    ).toBe("teaching_assistant");
    const invalid = await page.request.patch(path, {
      data: { kind: "invalid" },
    });
    expect(invalid.status()).toBe(400);
    await row
      .getByRole("button", { name: /订阅身份|Subscription role/ })
      .click();
    await dialog.getByRole("radio", { name: /旁听|Auditor/ }).click();
    await page.route(
      `**${path}`,
      (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Save temporarily unavailable" }),
        }),
      { times: 1 },
    );
    await dialog.getByRole("button", { name: /^(保存|Save)$/ }).click();
    await expect(
      dialog.getByText("Save temporarily unavailable"),
    ).toBeVisible();
    await expect(
      dialog.getByRole("radio", { name: /旁听|Auditor/ }),
    ).toHaveAttribute("data-state", "on");
    await dialog.getByRole("button", { name: /^(取消|Cancel)$/ }).click();
    expect(
      await withE2ePrisma((db) =>
        db.userSectionSubscription.findUnique({
          where: {
            userId_sectionId: {
              userId: account.id,
              sectionId: academic.section.id,
            },
          },
        }),
      ),
    ).toMatchObject({ kind: "teaching_assistant" });
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
    await page.screenshot({
      path: testInfo.outputPath("ta-homework-status.png"),
    });
    expect(errors).toEqual([]);
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      await page.locator("body").evaluate((body) => body.clientWidth),
    );
  });
}
