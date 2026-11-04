import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/public-worker";

for (const locale of ["en-us", "zh-cn"]) {
  test(`MCP client selection survives navigation (${locale})`, {
    tag: "@Site/Web",
  }, async ({ page, publicFlow, isolatedWorker }) => {
    await publicFlow.run(async () => {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
        ]);
      await gotoAndWaitForReady(page, "/usage/mcp?client=claude");
      const claude = page.getByRole("tab", { name: /Claude/ });
      const chatgpt = page.getByRole("tab", { name: /ChatGPT/ });
      const other = page.getByRole("tab").nth(2);
      await expect(claude).toHaveAttribute("aria-selected", "true");
      await claude.focus();
      await page.keyboard.press("ArrowRight");
      await expect(other).toHaveAttribute("aria-selected", "true");
      await expect(page).toHaveURL(/client=other/);
      await expect(other).toBeFocused();
      await page.reload();
      await expect(other).toHaveAttribute("aria-selected", "true");
      await chatgpt.click();
      await expect(page).toHaveURL(/client=chatgpt/);
      await page.goBack();
      await expect(other).toHaveAttribute("aria-selected", "true");
      await page.goForward();
      await expect(chatgpt).toHaveAttribute("aria-selected", "true");
      await gotoAndWaitForReady(page, "/usage/mcp?client=invalid");
      await expect(chatgpt).toHaveAttribute("aria-selected", "true");
    });
  });
}
