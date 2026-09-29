import { expect, type Page, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../../utils/signed-session-cookie";

let ownerId: string;
let sections: {
  id: number;
  jwId: number;
  code: string;
  semesterId: number | null;
}[];
let semesters: { id: number; nameCn: string }[];
const widths = [1280, 390];

test.beforeEach(async ({ page }) => {
  const marker = `subscription-view-${crypto.randomUUID().slice(0, 8)}`;
  await withE2ePrisma(async (db) => {
    const seed = await db.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.section.jwId },
      include: { teachers: true },
    });
    semesters = await db.semester.findMany({
      orderBy: { startDate: "desc" },
      take: 2,
      select: { id: true, nameCn: true },
    });
    expect(semesters).toHaveLength(2);
    const owner = await db.user.create({
      data: {
        name: marker,
        username: marker,
        email: `${marker}@example.test`,
        emailVerified: true,
      },
    });
    ownerId = owner.id;
    sections = [];
    const firstJwId = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);
    for (const index of [0, 1, 2]) {
      const section = await db.section.create({
        data: {
          jwId: firstJwId + index,
          code: `${marker}.${index + 1}`,
          courseId: seed.courseId,
          semesterId: semesters[index < 2 ? 0 : 1].id,
          teachers: { connect: seed.teachers.map(({ id }) => ({ id })) },
          credits: seed.credits,
        },
      });
      sections.push(section);
      await db.userSectionSubscription.create({
        data: { userId: ownerId, sectionId: section.id },
      });
    }
  });
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      await createSignedSessionCookie(ownerId),
      { name: "NEXT_LOCALE", value: "zh-cn", url: PLAYWRIGHT_BASE_URL },
    ]);
});

test.afterEach(async () => {
  await withE2ePrisma(async (db) => {
    await db.userSectionSubscription.deleteMany({ where: { userId: ownerId } });
    await db.section.deleteMany({
      where: { id: { in: sections.map(({ id }) => id) } },
    });
    await db.user.delete({ where: { id: ownerId } });
  });
});

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await gotoAndWaitForReady(page, "/workspace/subscriptions");
}

async function setLocale(page: Page, locale: string) {
  expect(
    (
      await page.request.post("/api/account/preferences", { data: { locale } })
    ).status(),
  ).toBe(200);
  await page
    .context()
    .addCookies([
      { name: "NEXT_LOCALE", value: locale, url: PLAYWRIGHT_BASE_URL },
    ]);
}

test("subscription.subscription-language", async ({ page }) => {
  for (const locale of ["zh-cn", "en-us"]) {
    await setLocale(page, locale);
    await open(page, 1280);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      locale === "zh-cn" ? "教学班订阅" : "Section Subscriptions",
    );
    await expect(
      page
        .getByRole("button", {
          name: locale === "zh-cn" ? "取消订阅" : "Unsubscribe",
          exact: true,
        })
        .first(),
    ).toBeVisible();
    const first = page
      .locator(
        `a[data-testid="subscription-course-link"][href="/catalog/sections/${sections[0].jwId}"]`,
      )
      .filter({ visible: true });
    await first.click();
    await page.waitForURL(`**/catalog/sections/${sections[0].jwId}`);
    const unsubscribe = page.getByRole("button", {
      name: /^(取消订阅|Unsubscribe from section)$/,
    });
    await expect(unsubscribe).toBeVisible();
    await unsubscribe.click();
    const confirmation = page.getByRole("alertdialog");
    if (await confirmation.count())
      await confirmation
        .getByRole("button", { name: /确认取消订阅|Unsubscribe|Confirm/i })
        .click();
    await expect(
      page.getByRole("button", { name: /^(订阅教学班|Subscribe to section)$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /^(Follow|Unfollow|Enroll|Unenroll|关注|取消关注|选课|退课)$/i,
      }),
    ).toHaveCount(0);
    const response = await page.request.patch("/api/workspace/subscriptions", {
      data: { sectionIds: [sections[0].id] },
    });
    expect(response.status()).toBe(200);
  }
});

test("subscription.quick-add-result-bound", async ({ page }) => {
  await withE2ePrisma(async (db) => {
    const seed = await db.section.findUniqueOrThrow({
      where: { id: sections[0].id },
    });
    const firstJwId = sections[0].jwId + 100;
    for (const index of Array.from({ length: 21 }, (_, i) => i)) {
      sections.push(
        await db.section.create({
          data: {
            code: `${seed.code}-search-${index}`,
            jwId: firstJwId + index,
            courseId: seed.courseId,
            semesterId: seed.semesterId,
          },
        }),
      );
    }
  });
  for (const locale of ["zh-cn", "en-us"]) {
    await setLocale(page, locale);
    for (const width of widths) {
      await open(page, width);
      await page
        .getByRole("button", { name: /^(添加订阅|Add subscription)$/i })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .locator("#subscriptions-quick-add-semester")
        .selectOption(String(sections[0].semesterId));
      await dialog
        .locator("#subscriptions-quick-add-code")
        .fill(DEV_SEED.course.code);
      await dialog.getByRole("button", { name: /^(搜索|Search)$/ }).click();
      await expect(dialog.getByRole("checkbox")).toHaveCount(20);
      await expect(
        dialog.getByText(
          locale === "zh-cn"
            ? "最多显示 20 个教学班，请增加限定条件"
            : "Up to 20 sections are shown. Add more details to narrow your search.",
          { exact: true },
        ),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
  }
});

test("subscription.kind-web-editor-location", async ({ page }) => {
  for (const locale of ["zh-cn", "en-us"]) {
    await setLocale(page, locale);
    for (const width of widths) {
      await open(page, width);
      for (const [kind, label] of [
        ["teaching_assistant", /^(助教|Teaching assistant)$/],
        ["auditor", /^(旁听|Auditor)$/],
        ["regular", /^(普通|Regular)$/],
      ] as const) {
        const link = page
          .locator(
            `a[data-testid="subscription-course-link"][href="/catalog/sections/${sections[0].jwId}"]`,
          )
          .filter({ visible: true });
        const row = link.locator(
          'xpath=ancestor::*[self::tr or @data-slot="item"][1]',
        );
        await row
          .getByRole("button", { name: /^(订阅身份|Subscription role)$/ })
          .click();
        const dialog = page.getByRole("dialog", {
          name: /^(订阅身份|Subscription role)$/,
        });
        await dialog.getByRole("radio", { name: label }).click();
        await dialog.getByRole("button", { name: /^(保存|Save)$/ }).click();
        await expect(dialog).toBeHidden();
        expect(
          await withE2ePrisma((db) =>
            db.userSectionSubscription.findUniqueOrThrow({
              where: {
                userId_sectionId: {
                  userId: ownerId,
                  sectionId: sections[0].id,
                },
              },
            }),
          ),
        ).toMatchObject({ kind });
        await row
          .getByRole("button", { name: /^(订阅身份|Subscription role)$/ })
          .click();
        await expect(
          dialog.getByRole("radio", { name: label }),
        ).toHaveAttribute("data-state", "on");
        await page.keyboard.press("Escape");
      }
    }
  }
});

test("subscribed-sections.grouped-by-semester", async ({ page }) => {
  for (const width of widths) {
    await open(page, width);
    const groups = page
      .getByTestId("subscription-semester-groups")
      .locator(":scope > section");
    await expect(groups).toHaveCount(2);
    for (const semester of semesters) {
      const group = groups.filter({
        has: page.getByRole("heading", {
          name: `学期：${semester.nameCn}`,
          exact: true,
        }),
      });
      await expect(group).toBeVisible();
      const expected = sections.filter(
        ({ semesterId }) => semesterId === semester.id,
      );
      await expect(
        group.getByTestId("subscription-course-link").filter({ visible: true }),
      ).toHaveCount(expected.length);
      await expect(group).toContainText(`${expected.length} 个班级`);
      for (const section of expected)
        await expect(
          group
            .locator(
              `a[data-testid="subscription-course-link"][href="/catalog/sections/${section.jwId}"]`,
            )
            .filter({ visible: true }),
        ).toBeVisible();
      for (const foreign of sections.filter(
        ({ semesterId }) => semesterId !== semester.id,
      ))
        await expect(
          group.locator(`a[href="/catalog/sections/${foreign.jwId}"]`),
        ).toHaveCount(0);
    }
  }
});

test("subscribed-sections.section-codes-promoted", async ({
  page,
}, testInfo) => {
  for (const width of widths) {
    await open(page, width);
    await page.screenshot({
      path: testInfo.outputPath(`subscription-codes-${width}.png`),
      fullPage: true,
    });
  }
  for (const width of widths) {
    await open(page, width);
    for (const section of sections) {
      const link = page
        .locator(
          `a[data-testid="subscription-course-link"][href="/catalog/sections/${section.jwId}"]`,
        )
        .filter({ visible: true });
      const item = link.locator(
        'xpath=ancestor::*[self::tr or @data-slot="item"][1]',
      );
      await expect(link).toContainText(DEV_SEED.course.nameCn);
      await expect(item).toContainText(DEV_SEED.teacher.nameCn);
      await expect(item.getByText(section.code, { exact: true })).toBeVisible();
      expect(
        await item
          .getByText(section.code, { exact: true })
          .evaluate((code) => getComputedStyle(code).fontFamily),
      ).toContain("monospace");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("subscribed-sections.sidebar-summary-only", async ({ page }) => {
  for (const width of widths) {
    await open(page, width);
    if (width < 768)
      await page.getByRole("button", { name: /^(菜单|Menu)$/ }).click();
    const sidebar =
      width < 768
        ? page.getByRole("dialog", { name: "Sidebar", exact: true })
        : page.getByTestId("app-sidebar");
    await expect(sidebar).toBeVisible();
    const destination = sidebar.locator('a[href="/workspace/subscriptions"]');
    await expect(destination).toHaveCount(1);
    await expect(destination).toContainText("教学班订阅");
    await expect(destination).toHaveAttribute("aria-current", "page");
    await expect(sidebar.locator('a[href^="/catalog/sections/"]')).toHaveCount(
      0,
    );
    for (const section of sections)
      await expect(sidebar).not.toContainText(section.code);
    if (width < 768) await page.keyboard.press("Escape");
  }
});
