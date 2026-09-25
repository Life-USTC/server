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

  test("支持来源多选筛选并明确显示新闻类型", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(
      page,
      `/news?source=${encodeURIComponent(fixture.sourceId)}`,
      { testInfo, screenshotLabel: "news-source-filter" },
    );

    await expect(
      page.getByRole("searchbox", { name: /^(搜索|Search)$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: fixture.title, exact: true }),
    ).toBeVisible();
    const moreFilters = page.getByRole("button", {
      name: /更多筛选|More filters/i,
    });
    await expect(moreFilters).toHaveAttribute("aria-expanded", "false");
    await moreFilters.click();
    const sourceFilter = page.getByRole("group", { name: /^(来源|Sources)$/ });
    await expect(
      sourceFilter.getByRole("checkbox", {
        name: fixture.sourceName,
        exact: true,
      }),
    ).toBeChecked();
    const sourceSearch = page.getByRole("searchbox", {
      name: /搜索来源名称|Search source names/i,
    });
    await sourceSearch.fill(fixture.officeSourceName);
    await expect(
      sourceFilter.getByRole("checkbox", {
        name: fixture.sourceName,
        exact: true,
      }),
    ).toBeHidden();
    await sourceFilter
      .getByRole("checkbox", { name: fixture.officeSourceName, exact: true })
      .check();
    // Closing advanced filters must not remove either selected source from GET submission.
    await moreFilters.click();
    await page.getByRole("button", { name: /^(搜索|Search)$/i }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.getAll("source"))
      .toEqual([fixture.sourceId, fixture.officeSourceId]);
    const unionTotal = fixture.total + fixture.officeTotal;
    await expect(
      page
        .getByText(new RegExp(`共 ${unionTotal} 条|${unionTotal} results`))
        .first(),
    ).toBeVisible();

    // Narrowing the same union to notices leaves only the office source's
    // rows, which is the AND of the type and source facets.
    await page.getByRole("radio", { name: /^(通知|Notice)$/i }).click();
    await expect(
      page.getByRole("radio", { name: /^(通知|Notice)$/i }),
    ).toBeChecked();
    await expect(
      page.getByRole("link", { name: fixture.title, exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("link", { name: "E2E office publication", exact: false })
        .first(),
    ).toBeVisible();
  });

  test("支持按组织层级聚合筛选", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/news?organizationLevel=office", {
      testInfo,
      screenshotLabel: "news-organization-level-filter",
    });

    await page.getByRole("button", { name: /更多筛选|More filters/i }).click();
    const levelFilter = page.getByRole("group", {
      name: /按组织层级筛选|Filter by organization level/i,
    });
    await expect(
      levelFilter.getByRole("checkbox", { name: /机关部处|Administrative/i }),
    ).toBeChecked();
    await expect(
      levelFilter.getByRole("checkbox", { name: /学校机关|^University$/i }),
    ).not.toBeChecked();

    // An office-level filter keeps the office source's notices and drops the
    // university-level fixture entirely.
    await expect(
      page
        .getByRole("link", { name: `E2E office publication`, exact: false })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: fixture.title, exact: true }),
    ).toHaveCount(0);

    await levelFilter
      .getByRole("checkbox", { name: /学校机关|^University$/i })
      .check();
    await page.getByRole("button", { name: /^(筛选|Filter)$/i }).click();
    await expect(
      page.getByRole("link", { name: fixture.title, exact: true }),
    ).toBeVisible();
  });

  test("分页使用链接导航并保留筛选条件", async ({ page }, testInfo) => {
    const sourceQuery = `source=${encodeURIComponent(fixture.sourceId)}`;
    await gotoAndWaitForReady(page, `/news?${sourceQuery}`, {
      testInfo,
      screenshotLabel: "news-pagination-first-page",
    });

    await expect(
      page
        .getByRole("list", { name: /校园新闻与通知|Campus News & Notices/i })
        .getByRole("listitem"),
    ).toHaveCount(20);
    const nextPage = page.getByRole("link", { name: /下一页|Next page/i });
    await expect(nextPage).toHaveAttribute(
      "href",
      `/news?${sourceQuery}&page=2`,
    );
    await nextPage.click();

    await expect(page).toHaveURL(new RegExp(`/news\\?${sourceQuery}&page=2$`));
    await expect(
      page
        .getByRole("list", { name: /校园新闻与通知|Campus News & Notices/i })
        .getByRole("listitem"),
    ).toHaveCount(fixture.total - 20);
    const previousPage = page.getByRole("link", {
      name: /上一页|Previous page/i,
    });
    await expect(previousPage).toHaveAttribute("href", `/news?${sourceQuery}`);
    await expect(
      page.getByRole("button", { name: /下一页|Next page/i }),
    ).toBeDisabled();

    await previousPage.click();
    await expect(page).toHaveURL(new RegExp(`/news\\?${sourceQuery}$`));
  });

  test("从详情返回保留筛选和分页，可逐项移除筛选", async ({
    page,
  }, testInfo) => {
    const listHref = `/news?type=news&source=${encodeURIComponent(fixture.sourceId)}&page=2`;
    await gotoAndWaitForReady(page, listHref, { testInfo });
    const article = page
      .getByRole("list", { name: /校园新闻与通知|Campus News & Notices/i })
      .getByRole("heading")
      .first()
      .getByRole("link");
    await article.click();
    const back = page.getByRole("link", {
      name: /返回新闻与通知|Back to news and notices/i,
    });
    await expect(back).toHaveAttribute("href", listHref);
    await back.click();
    await expect(page).toHaveURL(new URL(listHref, page.url()).href);
    await page
      .getByRole("link", {
        name: new RegExp(
          `移除筛选：${fixture.sourceName}|Remove filter: ${fixture.sourceName}`,
        ),
      })
      .click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("source"))
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("page"))
      .toBeNull();
    await expect(
      page.getByRole("radio", { name: /^(新闻|News)$/i }),
    ).toBeChecked();
    // Clicking the active type must not leave the group with no current selection.
    await page.getByRole("radio", { name: /^(新闻|News)$/i }).click();
    await expect(
      page.getByRole("radio", { name: /^(新闻|News)$/i }),
    ).toBeChecked();
  });

  test("移动端默认首屏能看到文章且长摘要不撑宽页面", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(
      page,
      `/news?source=${encodeURIComponent(fixture.sourceId)}`,
      { testInfo },
    );
    const firstArticle = page.getByRole("link", {
      name: fixture.title,
      exact: true,
    });
    await expect(firstArticle).toBeInViewport();
    await expect(
      page.getByRole("button", { name: /更多筛选|More filters/i }),
    ).toHaveAttribute("aria-expanded", "false");
    await expectNoPageHorizontalOverflow(page);
  });

  test("越界页重定向到保留筛选条件的最后一页", async ({ page }, testInfo) => {
    const sourceQuery = `source=${encodeURIComponent(fixture.sourceId)}`;
    await gotoAndWaitForReady(page, `/news?${sourceQuery}&page=9999`, {
      testInfo,
      screenshotLabel: "news-pagination-overflow",
    });

    await expect(page).toHaveURL(new RegExp(`/news\\?${sourceQuery}&page=2$`));
    await expect(
      page
        .getByRole("list", { name: /校园新闻与通知|Campus News & Notices/i })
        .getByRole("listitem"),
    ).toHaveCount(fixture.total - 20);
    await expect(
      page.getByRole("link", { name: /上一页|Previous page/i }),
    ).toHaveAttribute("href", `/news?${sourceQuery}`);
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
    const body = page.locator(".publication-body");
    const image = body.getByRole("img", { name: "Inline publication image" });
    await expect(image).toHaveAttribute("src", fixture.imageUrl);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
        ),
      )
      .toBe(true);
    const blocks = await body
      .locator(":scope > p")
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          node.querySelector("img") ? "image" : node.textContent,
        ),
      );
    expect(blocks.slice(0, 4)).toEqual([
      "This is the body text rendered by the public detail page.",
      "第二段正文，验证段间距与首行缩进。",
      "image",
      "This paragraph follows the inline image.",
    ]);
    await expect(
      page.getByText(
        "Legacy plain text must not be used as the rendered body.",
      ),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: /^(图片|Images|媒体|Media|附件|Attachments)$/i,
      }),
    ).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "news-inline-markdown");
  });

  test("本站图片接口读取缓存并支持条件请求", async ({ request }) => {
    const response = await request.get(fixture.imageUrl);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    const etag = response.headers().etag;
    expect(etag).toBeTruthy();
    const unchanged = await request.get(fixture.imageUrl, {
      headers: { "If-None-Match": etag },
    });
    expect(unchanged.status()).toBe(304);
    for (const hash of ["a".repeat(64), "invalid"]) {
      const missing = await request.get(`/api/publications/images/${hash}`);
      expect(missing.status()).toBe(hash === "invalid" ? 400 : 404);
      expect(missing.headers()["cache-control"]).toBe("no-store");
    }
    const detail = await request.get(`/api/publications/${fixture.id}`);
    expect(detail.status()).toBe(200);
    expect((await detail.json()).revision.bodyMarkdown).toContain(
      fixture.imageUrl,
    );
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
    const paragraphs = page.locator(".publication-body > p");
    const metrics = await paragraphs.nth(1).evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        font: Number.parseFloat(style.fontSize),
        indent: Number.parseFloat(style.textIndent),
        gap: Number.parseFloat(style.marginBlockStart),
      };
    });
    expect(metrics.indent).toBeCloseTo(metrics.font * 2);
    expect(metrics.gap).toBeCloseTo(metrics.font);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expectNoPageHorizontalOverflow(page);
      await expect(
        page.getByRole("link", { name: /查看来源原文|View source page/i }),
      ).toBeInViewport();
    }
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
