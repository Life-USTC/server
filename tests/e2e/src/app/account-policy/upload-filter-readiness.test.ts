import { expect } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";
import { absoluteTestUrl } from "../../../utils/request-url";

test("upload filters initialize SSR drafts and wait for hydration", {
  tag: "@Upload/Web",
}, async ({ page, baseURL, account, isolatedWorker, preferenceFlow }) => {
  await preferenceFlow.run(async () => {
    await isolatedWorker.database.owner.upload.create({
      data: {
        userId: account.id,
        key: `uploads/${account.id}/ready`,
        filename: "alpha.txt",
        size: 0,
      },
    });
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "en-us",
        url: absoluteTestUrl("/", baseURL),
      },
    ]);
    const release = createDeferred<void>();
    preferenceFlow.onClosing(() => release.resolve());
    await preferenceFlow.route(
      page,
      "**/_app/immutable/**/*.js",
      async (route) => {
        await release.promise;
        await route.continue();
      },
    );
    try {
      await page.goto("/workspace/uploads?filename=alpha", {
        waitUntil: "commit",
      });
      const search = page.locator("#uploads-filename");
      await expect(search).toHaveValue("alpha");
      await expect(search).toBeDisabled();
      for (const name of [
        "Uploaded",
        "More conditions",
        "Apply filters",
        "Reset",
      ])
        await expect(
          page.getByRole("button", { name, exact: true }),
        ).toBeDisabled();
      await expect(
        page.locator('[data-slot="active-filters"]').getByRole("link"),
      ).toHaveAttribute("aria-disabled", "true");
      release.resolve();
      await waitForUiSettled(page);
      await expect(search).toBeEnabled();
      for (const name of [
        "Uploaded",
        "More conditions",
        "Apply filters",
        "Reset",
      ])
        await expect(
          page.getByRole("button", { name, exact: true }),
        ).toBeEnabled();
    } finally {
      release.resolve();
      await preferenceFlow.clearRoutes(page);
    }
  });
});
test("upload long applied filename remains readable", {
  tag: "@Upload/Web",
}, async ({ page, baseURL, account, isolatedWorker, preferenceFlow }) => {
  await preferenceFlow.run(async () => {
    await isolatedWorker.database.owner.upload.create({
      data: {
        userId: account.id,
        key: `uploads/${account.id}/long`,
        filename: "existing.txt",
        size: 0,
      },
    });
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "en-us",
        url: absoluteTestUrl("/", baseURL),
      },
    ]);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const value = "long-filename-".repeat(20);
      await gotoAndWaitForReady(
        page,
        `/workspace/uploads?filename=${encodeURIComponent(value)}`,
      );
      const chip = page
        .locator('[data-slot="active-filters"]')
        .getByRole("link", {
          name: `Remove condition: File: ${value}`,
          exact: true,
        });
      await expect(chip).toBeVisible();
      await expect(chip).toHaveText(`File: ${value}`);
      expect(
        await chip
          .locator("span")
          .evaluate(
            (element) =>
              element.clientWidth >= element.scrollWidth &&
              element.clientHeight >= element.scrollHeight,
          ),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (process.env.UPLOAD_FILTER_EVIDENCE_DIR && width === 390)
        await page.screenshot({
          path: `${process.env.UPLOAD_FILTER_EVIDENCE_DIR}/uploads-long-filename-390.png`,
          fullPage: true,
          animations: "disabled",
        });
    }
  });
});
