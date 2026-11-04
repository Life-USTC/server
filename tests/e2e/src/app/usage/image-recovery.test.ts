import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/public-worker";

for (const locale of ["en-us", "zh-cn"]) {
  test(`Bot example image load failure recovers (${locale})`, {
    tag: "@Site/Web",
  }, async ({ page, publicFlow, isolatedWorker }) => {
    await publicFlow.run(async () => {
      if (process.env.USAGE_IMAGE_MOBILE)
        await page.setViewportSize({ width: 390, height: 844 });
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
        ]);
      let requests = 0;
      let allowImage = false;
      await page.route(
        "**/images/usage/presto-schedule.png*",
        async (route) => {
          requests++;
          if (!allowImage)
            await route.fulfill({
              status: 200,
              contentType: "image/png",
              body: "invalid png fixture",
            });
          else await route.continue();
        },
      );
      await gotoAndWaitForReady(page, "/usage/bot");
      const example = page
        .locator("[data-usage-marketing=example-card]")
        .first();
      await example.scrollIntoViewIfNeeded();
      const failure = example.getByRole("alert");
      if (process.env.USAGE_IMAGE_EVIDENCE) {
        await expect.poll(() => requests).toBe(1);
        await expect
          .poll(() =>
            example.evaluate((node) => {
              let item: Element | null = node;
              while (item) {
                if (Number(getComputedStyle(item).opacity) < 1) return false;
                item = item.parentElement;
              }
              return true;
            }),
          )
          .toBe(true);
        await page.screenshot({
          path: `${process.env.USAGE_IMAGE_EVIDENCE}/${locale}-failure.png`,
        });
      }
      await expect(failure).toBeVisible();
      await expect(failure).toContainText(/Image could not load|图片未能加载/);
      await expect(
        failure.getByRole("link", { name: /Open original|查看原图/ }),
      ).toHaveAttribute("href", "/images/usage/presto-schedule.png");
      allowImage = true;
      await failure.getByRole("button", { name: /Retry|重试/ }).click();
      await expect(failure).toBeHidden();
      await expect
        .poll(() =>
          example
            .locator("img")
            .evaluate((img) => (img as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      expect(requests).toBe(2);
      const preview = example.getByRole("button", {
        name: /Weekly schedule|本周课表/,
      });
      allowImage = false;
      await preview.click();
      await page
        .getByRole("dialog")
        .getByRole("img")
        .evaluate((image) => {
          (image as HTMLImageElement).src += "&failure-probe=1";
        });
      const dialogFailure = page.getByRole("dialog").getByRole("alert");
      await expect(dialogFailure).toBeVisible();
      allowImage = true;
      await dialogFailure.getByRole("button", { name: /Retry|重试/ }).click();
      await expect(dialogFailure).toBeHidden();
      await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(preview).toBeFocused();
    });
  });
}
