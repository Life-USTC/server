import { expect, test } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function createSearchViewers() {
  const query = `searchviewer${crypto.randomUUID().replaceAll("-", "")}`;
  const users = await withE2ePrisma(async (db) =>
    Promise.all(
      ["A", "B"].map((label) =>
        db.user.create({
          data: {
            name: `Search Viewer ${label}`,
            username: `${query}${label.toLowerCase()}`,
            email: `${query}${label}@example.test`,
            todos: { create: { title: `${query} note ${label}` } },
          },
        }),
      ),
    ),
  );
  return { query, users };
}

async function cleanupSearchViewers(
  users: Awaited<ReturnType<typeof createSearchViewers>>["users"],
) {
  const ids = users.map((user) => user.id);
  await withE2ePrisma(async (db) => {
    await db.auditLog.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { subjectUserId: { in: ids } }] },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });
}

test("signed-in search waits for its private scope and repeats the initial URL query after viewer resolution", async ({
  browser,
}) => {
  const { query, users } = await createSearchViewers();
  const context = await browser.newContext({ baseURL: PLAYWRIGHT_BASE_URL });
  const releaseBootstrap = createDeferred<void>();
  try {
    await context.addCookies([await createSignedSessionCookie(users[0].id)]);
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
    await cleanupSearchViewers(users);
  }
});

test("anonymous search never requests workspace scope or returns private results", async ({
  browser,
}) => {
  const { query, users } = await createSearchViewers();
  const context = await browser.newContext({ baseURL: PLAYWRIGHT_BASE_URL });
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
    await cleanupSearchViewers(users);
  }
});

test("an open search clears the previous viewer's results before receiving the next viewer's results", async ({
  browser,
}) => {
  const { query, users } = await createSearchViewers();
  const context = await browser.newContext({ baseURL: PLAYWRIGHT_BASE_URL });
  const nextBootstrap = createDeferred<void>();
  const releaseBootstrap = createDeferred<void>();
  const nextSearch = createDeferred<void>();
  const releaseSearch = createDeferred<void>();
  let holdNextViewer = false;
  try {
    await context.addCookies([await createSignedSessionCookie(users[0].id)]);
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
    await context.addCookies([await createSignedSessionCookie(users[1].id)]);
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
    await cleanupSearchViewers(users);
  }
});
