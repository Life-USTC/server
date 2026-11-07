import { expect } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { test } from "../../../utils/publication-filter-fixture";

const applyName = "Apply filters";
const moreName = /^More filters/;

for (const width of [1280, 390]) {
  test(`news chip removal preserves explicit empty source draft ${width}`, {
    tag: "@Publication/Web",
  }, async ({ page, publication: f, isolatedWorker, filterFlow }) => {
    await filterFlow.run(async () => {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      await page.setViewportSize({ width, height: 900 });
      const initial = `/news?source=${f.sourceId},${f.officeSourceId}`;
      await gotoAndWaitForReady(page, initial);
      const search = page.getByRole("searchbox", {
        name: "Search",
        exact: true,
      });
      await search.fill("publication");
      await page.getByRole("button", { name: moreName, exact: true }).click();
      let dialog = page.getByRole("dialog", { name: moreName, exact: true });
      await dialog
        .getByRole("checkbox", { name: f.officeSourceName, exact: true })
        .uncheck();
      await page.keyboard.press("Escape");
      expect(new URL(page.url()).searchParams.get("source")).toBe(
        `${f.sourceId},${f.officeSourceId}`,
      );
      await page
        .locator('[data-slot="active-filters"]')
        .getByRole("link", {
          name: `Remove filter: ${f.sourceName}`,
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("source") === f.officeSourceId,
      );
      await expect(search).toHaveValue("publication");
      await page.getByRole("button", { name: moreName, exact: true }).click();
      dialog = page.getByRole("dialog", { name: moreName, exact: true });
      await expect(
        dialog.getByRole("checkbox", { name: f.sourceName, exact: true }),
      ).not.toBeChecked();
      await expect(
        dialog.getByRole("checkbox", { name: f.officeSourceName, exact: true }),
      ).not.toBeChecked();
      await dialog
        .getByRole("button", { name: applyName, exact: true })
        .click();
      await expect(page).toHaveURL(
        (url) =>
          !url.searchParams.has("source") &&
          url.searchParams.get("query") === "publication",
      );
      await expect(
        page
          .getByRole("list", { name: "Campus News & Notices", exact: true })
          .getByRole("listitem"),
      ).toHaveCount(20);
      await page
        .locator('[data-slot="endless-scroll"]')
        .scrollIntoViewIfNeeded();
      await expect(
        page
          .getByRole("list", { name: "Campus News & Notices", exact: true })
          .getByRole("listitem"),
      ).toHaveCount(f.total + f.officeTotal);
    });
  });
}

test("news applied source chip retains another unsubmitted source and modified-click draft", {
  tag: "@Publication/Web",
}, async ({ page, publication: f, isolatedWorker, filterFlow }) => {
  await filterFlow.run(async () => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await gotoAndWaitForReady(page, `/news?source=${f.sourceId}`);
    await page.getByRole("button", { name: moreName, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("checkbox", { name: f.officeSourceName, exact: true })
      .check();
    await page.keyboard.press("Escape");
    const chip = page
      .locator('[data-slot="active-filters"]')
      .getByRole("link", {
        name: `Remove filter: ${f.sourceName}`,
        exact: true,
      });
    await chip.click({ modifiers: ["ControlOrMeta"] });
    // Modified native links can open a noopener tab: the context owns that page
    // even when the opener has no Playwright popup event.
    await expect.poll(() => page.context().pages().length).toBe(2);
    const popup = page
      .context()
      .pages()
      .find((candidate) => candidate !== page);
    if (!popup) throw new Error("Expected the native modified-click tab");
    await expect(popup).toHaveURL(
      (url) => url.pathname === "/news" && !url.searchParams.has("source"),
    );
    await waitForUiSettled(popup, { waitUntil: "networkidle" });
    await expect(
      popup
        .getByRole("list", { name: "Campus News & Notices", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(20);
    expect(new URL(page.url()).searchParams.get("source")).toBe(f.sourceId);
    await page.getByRole("button", { name: moreName, exact: true }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("checkbox", { name: f.sourceName, exact: true }),
    ).toBeChecked();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("checkbox", { name: f.officeSourceName, exact: true }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
    await chip.click();
    await expect(page).toHaveURL((url) => !url.searchParams.has("source"));
    await page.getByRole("button", { name: moreName, exact: true }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("checkbox", { name: f.sourceName, exact: true }),
    ).not.toBeChecked();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("checkbox", { name: f.officeSourceName, exact: true }),
    ).toBeChecked();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: applyName, exact: true })
      .click();
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("source") === f.officeSourceId,
    );
    await expect(
      page
        .getByRole("list", { name: "Campus News & Notices", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(f.officeTotal);
  });
});

for (const width of [1280, 390]) {
  test(`news latest draft survives a pending native Apply ${width}`, {
    tag: "@Publication/Web",
  }, async ({ page, publication: f, isolatedWorker, filterFlow }) => {
    const release = createDeferred<void>();
    let captured = 0;
    filterFlow.onClosing(() => release.resolve());
    await filterFlow.run(async () => {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/news");
      await filterFlow.route(
        page,
        (url) => url.pathname === "/news/__data.json",
        async (route) => {
          if (
            captured ||
            new URL(route.request().url()).searchParams.get("query") !==
              "publication"
          ) {
            await route.continue();
            return;
          }
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          captured++;
          await release.promise;
          await route.fulfill({ response });
        },
      );
      const search = page.getByRole("searchbox", {
        name: "Search",
        exact: true,
      });
      await search.fill("publication");
      await search.press("Enter");
      await expect.poll(() => captured).toBe(1);
      await search.fill("office");
      await page.getByRole("radio", { name: "Notice", exact: true }).click();
      await page.getByRole("button", { name: moreName, exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("checkbox", { name: f.officeSourceName, exact: true })
        .check();
      await page.keyboard.press("Escape");
      expect(new URL(page.url()).searchParams.has("query")).toBe(false);
      release.resolve();
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("query") === "publication",
      );
      await expect(search).toHaveValue("office");
      await expect(
        page.getByRole("radio", { name: "Notice", exact: true }),
      ).toBeChecked();
      await page.getByRole("button", { name: moreName, exact: true }).click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("checkbox", { name: f.officeSourceName, exact: true }),
      ).toBeChecked();
      await expect(page.locator('form[action="/news"]')).toHaveCount(1);
      await expect(
        page.locator(
          'button[type="submit"][form="publication-filters"]:visible',
        ),
      ).toHaveCount(1);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: applyName, exact: true })
        .click();
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get("query") === "office" &&
          url.searchParams.get("type") === "notice" &&
          url.searchParams.get("source") === f.officeSourceId,
      );
      await expect(
        page
          .getByRole("list", { name: "Campus News & Notices", exact: true })
          .getByRole("listitem"),
      ).toHaveCount(f.officeTotal);
    });
  });
}

test("news winning native Apply preserves newer edits and history resets from the target URL", {
  tag: "@Publication/Web",
}, async ({ page, publication: f, isolatedWorker, filterFlow }) => {
  const releases = [createDeferred<void>(), createDeferred<void>()];
  const fulfilled = [createDeferred<void>(), createDeferred<void>()];
  let captured = 0;
  filterFlow.onClosing(() => {
    for (const gate of releases) gate.resolve();
  });
  await filterFlow.run(async () => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await gotoAndWaitForReady(
      page,
      `/news?source=${f.sourceId},${f.officeSourceId}`,
    );
    await filterFlow.route(
      page,
      (url) => url.pathname === "/news/__data.json",
      async (route) => {
        if (captured >= 2) {
          await route.continue();
          return;
        }
        const index = captured++;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        await releases[index].promise;
        await route.fulfill({ response });
        fulfilled[index].resolve();
      },
    );
    const search = page.getByRole("searchbox", { name: "Search", exact: true });
    await search.fill("publication");
    await page.getByRole("button", { name: applyName, exact: true }).click();
    await expect.poll(() => captured).toBe(1);
    await search.fill("office");
    await page.getByRole("button", { name: applyName, exact: true }).click();
    await expect.poll(() => captured).toBe(2);
    await search.fill("E2E");
    await page.getByRole("radio", { name: "News", exact: true }).click();
    releases[1].resolve();
    await fulfilled[1].promise;
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("query") === "office",
    );
    await expect(
      page
        .getByRole("list", { name: "Campus News & Notices", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(f.officeTotal);
    await expect(search).toHaveValue("E2E");
    await expect(
      page.getByRole("radio", { name: "News", exact: true }),
    ).toBeChecked();
    releases[0].resolve();
    await fulfilled[0].promise;
    expect(new URL(page.url()).searchParams.get("query")).toBe("office");
    await expect(search).toHaveValue("E2E");
    await page.getByRole("button", { name: applyName, exact: true }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get("query") === "E2E" &&
        url.searchParams.get("type") === "news",
    );
    await expect(
      page
        .getByRole("list", { name: "Campus News & Notices", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(20);
    await page.goBack();
    await expect(search).toHaveValue("office");
    await expect(
      page.getByRole("radio", { name: "All", exact: true }),
    ).toBeChecked();
    await expect(
      page
        .getByRole("list", { name: "Campus News & Notices", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(f.officeTotal);
    await page.goForward();
    await expect(search).toHaveValue("E2E");
    await expect(
      page.getByRole("radio", { name: "News", exact: true }),
    ).toBeChecked();
    await search.fill("Not submitted");
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page).toHaveURL(
      (url) => url.pathname === "/news" && url.search === "",
    );
    await expect(search).toHaveValue("");
    await expect(
      page.getByRole("radio", { name: "All", exact: true }),
    ).toBeChecked();
    await expect(page.locator('[data-slot="active-filters"]')).toHaveCount(0);
  });
});

test("news organization chip retains an explicit empty level draft and other fields", {
  tag: "@Publication/Web",
}, async ({ page, publication: f, isolatedWorker, filterFlow }) => {
  await filterFlow.run(async () => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page.setViewportSize({ width: 390, height: 900 });
    await gotoAndWaitForReady(
      page,
      "/news?organizationLevel=university,office",
    );
    const search = page.getByRole("searchbox", { name: "Search", exact: true });
    await search.fill("publication");
    await page.getByRole("button", { name: moreName }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox", { name: /Administrative/ }).uncheck();
    await dialog
      .getByRole("checkbox", { name: f.officeSourceName, exact: true })
      .check();
    await page.keyboard.press("Escape");
    await page
      .locator('[data-slot="active-filters"]')
      .getByRole("link", { name: "Remove filter: University", exact: true })
      .click();
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("organizationLevel") === "office",
    );
    await expect(search).toHaveValue("publication");
    await page.getByRole("button", { name: moreName }).click();
    dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("checkbox", { name: /Administrative/ }),
    ).not.toBeChecked();
    await expect(
      dialog.getByRole("checkbox", { name: "University", exact: true }),
    ).not.toBeChecked();
    await expect(
      dialog.getByRole("checkbox", { name: f.officeSourceName, exact: true }),
    ).toBeChecked();
    await dialog.getByRole("button", { name: applyName, exact: true }).click();
    await expect(page).toHaveURL(
      (url) =>
        !url.searchParams.has("organizationLevel") &&
        url.searchParams.get("source") === f.officeSourceId &&
        url.searchParams.get("query") === "publication",
    );
    await expect(
      page
        .getByRole("list", { name: "Campus News & Notices", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(f.officeTotal);
  });
});

for (const mode of ["empty", "hidden", "unmatched"] as const) {
  test(`news empty copy uses public visibility for ${mode}`, {
    tag: "@Publication/Web",
  }, async ({ page, publication: f, isolatedWorker, filterFlow }) => {
    const db = isolatedWorker.database.owner;
    await filterFlow.prepare(async () => {
      if (mode === "empty") await db.publication.deleteMany();
      if (mode === "hidden")
        await db.publicationRevision.updateMany({
          data: { isTombstone: true },
        });
    });
    const before = await db.publication.findMany({ orderBy: { id: "asc" } });
    await filterFlow.run(async () => {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      await gotoAndWaitForReady(
        page,
        mode === "unmatched"
          ? "/news?source=not-registered-1437&organizationLevel=office"
          : "/news",
      );
      const title =
        mode === "unmatched"
          ? "No matching publications"
          : "No public publications";
      await expect(page.getByText(title, { exact: true })).toBeVisible();
      await expect(
        page.getByRole("link", { name: f.title, exact: true }),
      ).toHaveCount(0);
      if (mode === "unmatched") {
        await expect(
          page.locator('[data-slot="active-filters"]'),
        ).toContainText("not-registered-1437");
        await page
          .getByRole("button", { name: applyName, exact: true })
          .click();
        await expect(page).toHaveURL(
          (url) => url.searchParams.get("source") === "not-registered-1437",
        );
        await expect(page.getByText(title, { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await expect(page).toHaveURL(
          (url) => url.pathname === "/news" && url.search === "",
        );
        await expect(
          page.getByRole("link", { name: f.title, exact: true }),
        ).toBeVisible();
      }
      expect(await db.publication.findMany({ orderBy: { id: "asc" } })).toEqual(
        before,
      );
    });
  });
}
