import { expect } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { test } from "../../../utils/public-worker";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";

for (const theme of ["light", "dark"] as const) {
  for (const width of [1280, 390]) {
    test(
      `active Workspace caption retains readable contrast ${theme} ${width}`,
      { tag: "@Site/Web" },
      async ({ page, isolatedWorker, publicFlow }, info) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: 900 });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
          ]);
        await publicFlow.run(async () => {
          await gotoAndWaitForReady(page, "/");
          if (width < 768) {
            await page
              .getByRole("button", { name: "Menu", exact: true })
              .click();
          }
          const navigation = page.locator(
            `[data-shell-navigation="${width < 768 ? "mobile" : "desktop"}"]`,
          );
          const home = navigation.getByRole("link", {
            name: "Workspace",
            exact: true,
          });
          await expect(home).toHaveCount(1);
          await expect(
            navigation.locator('a[aria-current="page"]'),
          ).toHaveCount(1);
          await expect(home).toHaveAttribute("href", "/");
          await expect(home).toHaveAttribute("aria-current", "page");
          await expect(
            home.getByText("Workspace", { exact: true }),
          ).toBeVisible();
          await waitForUiSettled(page);
          await page.screenshot({
            path: info.outputPath(`home-${theme}-${width}.png`),
            fullPage: true,
          });
          await info.attach("home-caption-style", {
            body: JSON.stringify(
              await home
                .getByText("Workspace", { exact: true })
                .evaluate((caption) => {
                  const color = getComputedStyle(caption).color;
                  const ancestors = [];
                  for (
                    let node: Element | null = caption;
                    node;
                    node = node.parentElement
                  ) {
                    const style = getComputedStyle(node);
                    ancestors.push({
                      tag: node.tagName,
                      color: style.color,
                      background: style.backgroundColor,
                    });
                  }
                  return { color, ancestors };
                }),
            ),
            contentType: "application/json",
          });
          await expectRenderedUiQuality(page);
          await publicFlow.assertAnonymousNoEffects();
        });
      },
    );
  }
}
