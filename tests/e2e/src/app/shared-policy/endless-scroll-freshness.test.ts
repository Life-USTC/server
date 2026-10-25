import { expect, type Page } from "@playwright/test";
import { unflatten } from "devalue";
import { observeAction } from "../../../utils/observed-action";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { publicationStorageTest as test } from "../../../utils/publication-fixture";

function uploadData(userId: string, prefix: string) {
  return Array.from({ length: 25 }, (_, index) => ({
    userId,
    key: `${prefix}/${index}`,
    filename: `${prefix}-${String(index).padStart(2, "0")}.txt`,
    contentType: "text/plain",
    size: 1024,
    createdAt: new Date(Date.UTC(2035, 0, 1, 0, 0, index)),
  }));
}

const nextBatch = (url: URL) =>
  url.pathname === "/workspace/uploads/__data.json" &&
  url.searchParams.get("page") === "2";

async function loadMoreWithKeyboard(page: Page) {
  const continuation = page.locator('[data-slot="endless-scroll"]');
  await expect(continuation).not.toBeInViewport();
  await continuation
    .getByRole("link", { name: "Load more", exact: true })
    .evaluate((element) =>
      (element as HTMLElement).focus({ preventScroll: true }),
    );
  await observeAction(
    () =>
      page.waitForResponse((response) => nextBatch(new URL(response.url()))),
    () => page.keyboard.press("Enter"),
  );
}

test("endless uploads refresh instead of mixing viewers after a session changes", {
  tag: "@Upload/Web",
}, async ({ page, isolatedWorker, browseRun, run }) => {
  await browseRun(async () => {
    const first = await isolatedWorker.createActor();
    const second = await isolatedWorker.createActor();
    const firstUploads = uploadData(first.id, "endless-viewer-first");
    const secondUploads = uploadData(second.id, "endless-viewer-second");
    await isolatedWorker.database.owner.upload.createMany({
      data: [...firstUploads, ...secondUploads],
    });
    await page
      .context()
      .addCookies([
        first.cookie,
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoAndWaitForReady(
      page,
      "/workspace/uploads?filename=endless-viewer",
    );
    const originalUrl = page.url();
    const rows = page.locator("main table:visible tbody tr");
    const filenames = rows.locator("td:first-child");
    await expect(filenames).toHaveText(
      firstUploads
        .slice()
        .reverse()
        .slice(0, 20)
        .map((upload) => upload.filename),
    );

    // A different tab can replace the shared session without navigating this
    // document. Its next route read must not append that viewer's page 2 to A.
    await page.context().addCookies([second.cookie]);
    const requestedPages: number[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/workspace/uploads/__data.json")
        requestedPages.push(Number(url.searchParams.get("page") ?? 1));
    });
    await page.route(
      nextBatch,
      (route) =>
        run(async () => {
          const response = await route.fetch({ maxRedirects: 0 });
          expect(response.status()).toBe(200);
          const envelope = await response.json();
          expect(unflatten(envelope.nodes[0].data)).toMatchObject({
            user: { id: second.id },
          });
          await route.fulfill({ response });
        }),
      { times: 1 },
    );
    await loadMoreWithKeyboard(page);
    await expect(filenames).toHaveText(
      secondUploads
        .slice()
        .reverse()
        .slice(0, 20)
        .map((upload) => upload.filename),
    );
    await expect(page).toHaveURL(originalUrl);
    expect(requestedPages).toEqual([2, 1]);
    await loadMoreWithKeyboard(page);
    await expect(filenames).toHaveText(
      secondUploads
        .slice()
        .reverse()
        .map((upload) => upload.filename),
    );
    await expect(page.locator('[data-slot="endless-scroll"]')).toHaveCount(0);
    expect(requestedPages).toEqual([2, 1, 2]);
  });
});

test("endless uploads keep fresh server rows after a full reload", {
  tag: "@Upload/Web",
}, async ({ page, isolatedWorker, browseRun }) => {
  await browseRun(async () => {
    const actor = await isolatedWorker.createActor();
    const uploads = uploadData(actor.id, "endless-reload");
    await isolatedWorker.database.owner.upload.createMany({ data: uploads });
    await page
      .context()
      .addCookies([
        actor.cookie,
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoAndWaitForReady(
      page,
      "/workspace/uploads?filename=endless-reload",
    );
    const rows = page.locator("main table:visible tbody tr");
    const filenames = rows.locator("td:first-child");
    await expect(rows).toHaveCount(20);
    await loadMoreWithKeyboard(page);
    await expect(rows).toHaveCount(25);

    const renamed = "endless-reload-updated.txt";
    const changed = await isolatedWorker.database.owner.$transaction([
      isolatedWorker.database.owner.upload.updateMany({
        where: { userId: actor.id, filename: uploads[24].filename },
        data: { filename: renamed },
      }),
      isolatedWorker.database.owner.upload.deleteMany({
        where: { userId: actor.id, filename: uploads[23].filename },
      }),
    ]);
    expect(changed.map((result) => result.count)).toEqual([1, 1]);
    const response = await page.reload({ waitUntil: "domcontentloaded" });
    if (!response) throw new Error("Expected a fresh reload document response");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(renamed);
    expect(html).not.toContain(uploads[24].filename);
    expect(html).not.toContain(uploads[23].filename);
    await waitForUiSettled(page);
    await expect(filenames).toHaveText([
      renamed,
      ...uploads
        .slice(0, 23)
        .reverse()
        .slice(0, 19)
        .map((upload) => upload.filename),
    ]);
  });
});
