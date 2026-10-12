import { expect } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { test } from "../../../utils/owned-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

/** Two viewers of this case's own Worker, each with one private note. */
async function createSearchViewers(
  isolatedWorker: Parameters<Parameters<typeof test>[2]>[0]["isolatedWorker"],
) {
  const query = `searchviewer${crypto.randomUUID().replaceAll("-", "")}`;
  const db = isolatedWorker.database.owner;
  const viewers = [];
  for (const label of ["A", "B"]) {
    const actor = await isolatedWorker.createActor();
    viewers.push(
      await db.user.update({
        where: { id: actor.id },
        data: {
          name: `Search Viewer ${label}`,
          username: `${query}${label.toLowerCase()}`,
          todos: { create: { title: `${query} note ${label}` } },
        },
      }),
    );
  }
  // The fixture drops this database, so the case owns no teardown.
  return { query, users: viewers };
}

test("signed-in search waits for its private scope and repeats the initial URL query after viewer resolution", {
  tag: "@Search/Web",
}, async ({ browser, isolatedWorker }) => {
  const { query, users } = await createSearchViewers(isolatedWorker);
  const context = await browser.newContext({ baseURL: isolatedWorker.origin });
  const releaseBootstrap = createDeferred<void>();
  try {
    await context.addCookies([
      (await isolatedWorker.createSession(users[0].id)).cookie,
    ]);
    const page = await context.newPage();
    const privateRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname === "/api/search" &&
        url.searchParams.get("scope") === "workspace"
      )
        privateRequests.push(request.url());
    });
    await page.route("**/_internal/shell-bootstrap", async (route) => {
      const response = await route.fetch();
      await releaseBootstrap.promise;
      await route.fulfill({ response });
    });
    const publicResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/search" &&
        !url.searchParams.has("scope") &&
        url.searchParams.get("q") === query
      );
    });
    await page.goto(`/search?q=${query}`);
    expect((await publicResponse).status()).toBe(200);
    await expect(page.getByRole("combobox")).toHaveValue(query);
    expect(privateRequests).toEqual([]);
    await expect(
      page.getByRole("option", { name: new RegExp(`${query} note`) }),
    ).toHaveCount(0);

    const personalResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/search" &&
        url.searchParams.get("scope") === "workspace" &&
        url.searchParams.get("q") === query
      );
    });
    releaseBootstrap.resolve();
    const personal = await personalResponse;
    expect(personal.status()).toBe(200);
    expect(personal.headers()["cache-control"]).toBe("private, no-store");
    await expect(
      page.getByRole("option", { name: new RegExp(`${query} note A`) }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: new RegExp(`${query} note B`) }),
    ).toHaveCount(0);
    expect(privateRequests).toHaveLength(1);
  } finally {
    releaseBootstrap.resolve();
    await context.close();
  }
});

test("anonymous search never requests workspace scope or returns private results", {
  tag: "@Search/Web",
}, async ({ browser, isolatedWorker }) => {
  const { query } = await createSearchViewers(isolatedWorker);
  const context = await browser.newContext({ baseURL: isolatedWorker.origin });
  try {
    const page = await context.newPage();
    const scopes: Array<string | null> = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/search")
        scopes.push(url.searchParams.get("scope"));
    });
    await gotoAndWaitForReady(page, `/search?q=${query}`);
    const response = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/search" &&
        url.searchParams.get("q") === `${query} note`
      );
    });
    await page.getByRole("combobox").fill(`${query} note`);
    expect((await response).status()).toBe(200);
    await expect(
      page.getByRole("option", { name: new RegExp(query) }),
    ).toHaveCount(0);
    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes.every((scope) => scope === null)).toBe(true);
  } finally {
    await context.close();
  }
});

test("an open search clears the previous viewer's results before receiving the next viewer's results", {
  tag: "@Search/Web",
}, async ({ browser, isolatedWorker }) => {
  const { query, users } = await createSearchViewers(isolatedWorker);
  const context = await browser.newContext({ baseURL: isolatedWorker.origin });
  const nextBootstrap = createDeferred<void>();
  const releaseBootstrap = createDeferred<void>();
  const nextSearch = createDeferred<void>();
  const releaseSearch = createDeferred<void>();
  let holdNextViewer = false;
  try {
    await context.addCookies([
      (await isolatedWorker.createSession(users[0].id)).cookie,
    ]);
    const page = await context.newPage();
    await page.route("**/_internal/shell-bootstrap", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      // A failed navigation summary keeps programmatic URL changes eligible
      // for shell refresh while the real server still resolves each viewer.
      body.navigation = null;
      if (holdNextViewer && body.viewer?.id === users[1].id) {
        nextBootstrap.resolve();
        await releaseBootstrap.promise;
      }
      await route.fulfill({ response, json: body });
    });
    await page.route("**/api/search?*", async (route) => {
      const url = new URL(route.request().url());
      if (holdNextViewer && url.searchParams.get("scope") === "workspace") {
        nextSearch.resolve();
        await releaseSearch.promise;
      }
      await route.continue();
    });
    await gotoAndWaitForReady(page, `/search?q=${query}`);
    await expect(
      page.getByRole("option", { name: new RegExp(`${query} note A`) }),
    ).toBeVisible();
    await context.clearCookies();
    await context.addCookies([
      (await isolatedWorker.createSession(users[1].id)).cookie,
    ]);
    holdNextViewer = true;
    await page.getByRole("combobox").fill(`${query} note`);
    await Promise.all([nextBootstrap.promise, nextSearch.promise]);
    releaseBootstrap.resolve();
    await expect(page.locator("#app-user-menu")).toContainText(
      users[1].name ?? "",
    );
    await expect(
      page.getByRole("option", { name: new RegExp(`${query} note A`) }),
    ).toHaveCount(0);
    releaseSearch.resolve();
    await expect(
      page.getByRole("option", { name: new RegExp(`${query} note B`) }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: new RegExp(`${query} note A`) }),
    ).toHaveCount(0);

    await context.clearCookies();
    const anonymousSearch = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/search" &&
        !url.searchParams.has("scope") &&
        url.searchParams.get("q") === query
      );
    });
    await page.getByRole("combobox").fill(query);
    expect((await anonymousSearch).status()).toBe(200);
    await expect(
      page.getByRole("option", { name: new RegExp(query) }),
    ).toHaveCount(0);
  } finally {
    releaseBootstrap.resolve();
    releaseSearch.resolve();
    await context.close();
  }
});
