import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/public-worker";

for (const theme of ["light", "dark"] as const) {
  test(
    `MCP tabs retain readable contrast ${theme}`,
    { tag: "@Site/Web" },
    async ({ page, publicFlow }, info) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 393, height: 851 });
      await publicFlow.run(async () => {
        await gotoAndWaitForReady(page, "/usage/mcp");
        for (const tab of await page.getByRole("tab").all()) {
          await tab.click();
          await expect(tab).toHaveAttribute("aria-selected", "true");
          await info.attach(`tabs-${theme}`, {
            body: await page.screenshot(),
            contentType: "image/png",
          });
          const result = await new AxeBuilder({ page })
            .include("[role=tablist]")
            .withRules(["color-contrast"])
            .analyze();
          expect
            .soft(
              result.violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => n.failureSummary),
              })),
            )
            .toEqual([]);
        }
      });
    },
  );
}
