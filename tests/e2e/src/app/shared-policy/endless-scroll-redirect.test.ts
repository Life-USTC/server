import { expect } from "@playwright/test";
import { observeAction } from "../../../utils/observed-action";
import { test } from "../../../utils/other-collection-policy-fixture";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";

test("endless uploads refresh the valid page after the dataset shrinks", {
  tag: "@Upload/Web",
}, async ({ page, browseRun, isolatedWorker, collection, run }) => {
  await browseRun(async () => {
    await page
      .context()
      .addCookies([
        (await isolatedWorker.createSession(collection.admin.id)).cookie,
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page.setViewportSize({ width: 1280, height: 720 });
    const path = `/workspace/uploads?filename=${encodeURIComponent(collection.catalog.marker)}`;
    await gotoAndWaitForReady(page, path);
    const originalUrl = page.url();
    const historyLength = await page.evaluate(() => history.length);
    const rows = page.locator("main table:visible tbody tr");
    const continuation = page.locator('[data-slot="endless-scroll"]');
    await expect(rows).toHaveCount(20);
    await expect(continuation).not.toBeInViewport();

    const filenames = Array.from(
      { length: 5 },
      (_, index) =>
        `${collection.catalog.marker}-file-${String(index).padStart(2, "0")}-with-a-long-readable-filename.txt`,
    );
    const removed = await isolatedWorker.database.owner.upload.deleteMany({
      where: {
        userId: collection.admin.id,
        filename: { notIn: filenames },
      },
    });
    expect(removed.count).toBe(20);
    await expect(rows).toHaveCount(20);

    const requestedPages: number[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/workspace/uploads/__data.json")
        requestedPages.push(Number(url.searchParams.get("page") ?? 1));
    });
    const nextBatch = (url: URL) =>
      url.pathname === "/workspace/uploads/__data.json" &&
      url.searchParams.get("page") === "2";
    let redirected: unknown;
    await page.route(
      nextBatch,
      (route) =>
        run(async () => {
          const response = await route.fetch({ maxRedirects: 0 });
          expect(response.status()).toBe(200);
          // The client cancels its stream after reading the redirect. Preserve
          // the real Worker response before forwarding it unchanged.
          redirected = await response.json();
          await route.fulfill({ response });
        }),
      { times: 1 },
    );
    const more = continuation.getByRole("link", {
      name: "Load more",
      exact: true,
    });
    await more.evaluate((element) =>
      (element as HTMLElement).focus({ preventScroll: true }),
    );
    await observeAction(
      () =>
        page.waitForResponse((response) => nextBatch(new URL(response.url()))),
      () => page.keyboard.press("Enter"),
    );
    expect(redirected).toMatchObject({
      type: "redirect",
      location: path,
    });
    await expect(rows).toHaveCount(5);
    await expect(page).toHaveURL(originalUrl);
    await waitForUiSettled(page);
    expect(
      (await rows.locator("td:first-child").allTextContents())
        .map((text) => text.trim())
        .sort(),
    ).toEqual(filenames.sort());
    await expect(continuation).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Retry", exact: true }),
    ).toHaveCount(0);
    expect(requestedPages).toEqual([2, 1]);
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    expect(errors).toEqual([]);
  });
});
