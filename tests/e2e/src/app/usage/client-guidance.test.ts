import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/public-worker";

for (const locale of ["en-us", "zh-cn"]) {
  test(
    `MCP tutorial completion matches selected client ${locale}`,
    { tag: "@Site/Web" },
    async ({ page, publicFlow, isolatedWorker }, info) => {
      await publicFlow.run(async () => {
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await page.setViewportSize({ width: 1024, height: 900 });
        await gotoAndWaitForReady(page, "/usage/mcp?client=claude");
        const claude = page.getByRole("tabpanel");
        await claude
          .locator("[data-usage-marketing=example-card]")
          .last()
          .scrollIntoViewIfNeeded();
        if (process.env.GUIDE_EVIDENCE_DIR)
          await page.screenshot({
            path: `${process.env.GUIDE_EVIDENCE_DIR}/${locale}.png`,
          });
        await info.attach(`claude-completion-${locale}`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });
        await expect(
          claude.locator('img[src="/images/usage/mcp-use-case.png"]'),
        ).toHaveCount(0);
        await expect(
          page
            .locator("[data-usage-marketing=hero]")
            .getByRole("img", { name: /ChatGPT/ }),
        ).toHaveCount(0);
        await expect(claude).toContainText("Connectors");
        await expect(
          claude.getByRole("button", { name: /catalog_section_search/ }),
        ).toBeVisible();
        await page
          .context()
          .grantPermissions(["clipboard-read", "clipboard-write"]);
        await claude
          .getByRole("button", { name: /catalog_section_search/ })
          .click();
        await expect
          .poll(() => page.evaluate(() => navigator.clipboard.readText()))
          .toContain("catalog_section_search");
        await page.getByRole("tab", { name: /ChatGPT/ }).click();
        await expect(page).toHaveURL(/client=chatgpt/);
        await expect(page.getByRole("tabpanel")).toContainText("Plugins");
        await expect(
          page
            .getByRole("tabpanel")
            .getByRole("img", { name: /ChatGPT/ })
            .first(),
        ).toBeVisible();
        await page.goBack();
        await expect(page.getByRole("tab", { name: /Claude/ })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(
          page
            .getByRole("tabpanel")
            .locator('img[src="/images/usage/mcp-use-case.png"]'),
        ).toHaveCount(0);
      });
    },
  );
}
