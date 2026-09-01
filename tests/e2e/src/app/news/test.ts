import { expect, test } from "@playwright/test";
import {
  createPublicationFixture,
  deletePublicationFixture,
  type PublicationFixture,
} from "../../../utils/e2e-db";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

test.describe.configure({ mode: "serial" });

let fixture: PublicationFixture;

test.beforeAll(async () => {
  fixture = await createPublicationFixture(
    `news-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
  );
});

test.afterAll(async () => {
  await deletePublicationFixture(fixture);
});

test.describe("/news 新闻与通知预览", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/news", testInfo });
  });

  test("支持来源筛选并明确显示新闻类型", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(
      page,
      `/news?source=${encodeURIComponent(fixture.sourceId)}`,
      { testInfo, screenshotLabel: "news-source-filter" },
    );

    await expect(
      page.getByRole("textbox", { name: /来源标识|Source ID/i }),
    ).toHaveValue(fixture.sourceId);
    await expect(
      page.getByRole("searchbox", { name: /搜索|Search/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
    await expect(page.getByText(/新闻|News/i).first()).toBeVisible();

    await page.getByRole("combobox").selectOption("notice");
    await page.getByRole("button", { name: /筛选|Filter/i }).click();
    await expect(
      page.getByText(/暂无公开内容|No public publications/i),
    ).toBeVisible();
  });

  test("详情页显示正文和来源链接", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, `/news/${fixture.id}`, {
      testInfo,
      screenshotLabel: "news-detail",
    });

    await expect(
      page.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "This is the body text rendered by the public detail page.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /查看来源原文|View source page/i }),
    ).toHaveAttribute("href", fixture.canonicalUrl);
    await expect(
      page.locator("[data-slot='card']").filter({ hasText: "<script" }),
    ).toHaveCount(0);
  });

  test("移动端新闻详情保持正文可读且无横向溢出", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, `/news/${fixture.id}`, {
      testInfo,
      expectNoHorizontalOverflow: true,
      screenshotLabel: "news-detail-mobile",
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText(
        "This is the body text rendered by the public detail page.",
      ),
    ).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
    await captureStepScreenshot(page, testInfo, "news-detail-mobile");
  });

  test("详情页无效 id 返回 404", async ({ page }) => {
    const response = await gotoAndWaitForReady(
      page,
      "/news/not-existing-publication",
      { expectMainContent: false },
    );
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("404");
  });
});
