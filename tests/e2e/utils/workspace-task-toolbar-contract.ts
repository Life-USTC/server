import { expect, type Page } from "@playwright/test";

/** Real local draft edits must remain independent from applied-condition removal. */
export async function expectTaskToolbarDraftContract(
  page: Page,
  tab: "homeworks" | "todos",
  title: string,
) {
  const toolbar = page.locator('[data-slot="workspace-task-filter-toolbar"]');
  const dueName = tab === "todos" ? "dueAt" : "submissionDueAt";
  const moreName = tab === "todos" ? "content" : "description";
  const visibleTitle = page
    .getByRole("button", { name: title, exact: true })
    .filter({ visible: true });
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await toolbar.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(visibleTitle).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: "Apply filters", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.locator(
        'thead:visible [data-slot="table-column-header"], [data-slot="collection-header"]:visible',
      ),
    ).toHaveCount(0);
    await toolbar.getByRole("searchbox").fill("unsubmitted search");
    await expect(visibleTitle).toBeVisible();
    await toolbar.locator(`[data-filter-trigger="${dueName}"]`).click();
    const due = page.locator(`[data-filter-field="${dueName}"]:visible`);
    await due.getByRole("combobox").selectOption("between");
    await due.locator('input[type="date"]').nth(0).fill("2099-01-01");
    await due.locator('input[type="date"]').nth(1).fill("2099-01-05");
    await page.keyboard.press("Escape");
    await toolbar
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await expect(visibleTitle).toHaveCount(0);
    await expect(
      page
        .getByText(
          tab === "todos"
            ? "No todos match the current filter"
            : "No homework under this filter",
          { exact: true },
        )
        .filter({ visible: true }),
    ).toBeVisible();
    const applied = toolbar.locator('[data-slot="active-filters"]');
    await expect(applied).toContainText(
      "Between (inclusive) 2099-01-01 – 2099-01-05",
    );
    await toolbar.getByRole("searchbox").fill("retained draft");
    await toolbar.locator('[data-filter-trigger="more"]').click();
    const extra = page.locator(
      `[data-filter-field="${moreName}"]:visible input`,
    );
    await extra.fill("retained details");
    await page.keyboard.press("Escape");
    await toolbar.locator('[data-filter-trigger="more"]').click();
    await expect(extra).toHaveValue("retained details");
    await page.keyboard.press("Escape");
    await applied
      .getByRole("button", {
        name: /^Remove condition: (Due date|Submission due):/,
      })
      .click();
    await expect(toolbar.getByRole("searchbox")).toHaveValue("retained draft");
    await expect(applied).toContainText("unsubmitted search");
    await expect(applied).not.toContainText("2099-01-01");
    await toolbar.locator(`[data-filter-trigger="${dueName}"]`).click();
    await expect(due.getByRole("combobox")).toHaveValue("eq");
    await expect(due.locator('input[type="date"]')).toHaveValue("");
    await page.keyboard.press("Escape");
    await toolbar.locator('[data-filter-trigger="more"]').click();
    await expect(extra).toHaveValue("retained details");
    await page.keyboard.press("Escape");
    await toolbar.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(toolbar.getByRole("searchbox")).toHaveValue("");
    await expect(applied).toHaveCount(0);
    await expect(visibleTitle).toBeVisible();
    await toolbar.locator('[data-filter-trigger="more"]').click();
    await expect(extra).toHaveValue("");
    await page.keyboard.press("Escape");
    const longTitle = "long-title-".repeat(28);
    await toolbar.getByRole("searchbox").fill(longTitle);
    await toolbar
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    const titleChip = applied.getByRole("button", {
      name: `Remove condition: Title: ${longTitle}`,
      exact: true,
    });
    await expect(titleChip).toBeVisible();
    await expect(titleChip).toHaveText(`Title: ${longTitle}`);
    const chipBox = await titleChip.boundingBox();
    expect(chipBox).not.toBeNull();
    expect(chipBox?.x).toBeGreaterThanOrEqual(0);
    expect((chipBox?.x ?? 0) + (chipBox?.width ?? 0)).toBeLessThanOrEqual(
      width,
    );
    expect(
      await titleChip
        .locator("span")
        .evaluate(
          (element) =>
            element.scrollWidth <= element.clientWidth &&
            element.scrollHeight <= element.clientHeight,
        ),
    ).toBe(true);
    if (process.env.FILTER_EVIDENCE_DIR && width === 390)
      await page.screenshot({
        path: `${process.env.FILTER_EVIDENCE_DIR}/${tab}-long-title-390.png`,
        fullPage: true,
        animations: "disabled",
      });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
}
