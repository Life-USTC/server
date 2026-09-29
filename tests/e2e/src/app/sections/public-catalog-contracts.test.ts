import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { unflatten } from "devalue";
import {
  type CatalogContractFixture,
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../../../../shared/catalog-contract-fixture";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/signed-session-cookie";

let fixture: CatalogContractFixture;
let user: { id: string };
test.beforeEach(async () => {
  fixture = await withE2ePrisma(createCatalogContractFixture);
  user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        email: `${fixture.marker}@example.test`,
        name: "Catalog contract viewer",
        username: fixture.marker,
      },
    }),
  );
});
test.afterEach(async () => {
  await withE2ePrisma(async (db) => {
    await db.auditLog.deleteMany({
      where: { OR: [{ userId: user.id }, { subjectUserId: user.id }] },
    });
    await db.homework.deleteMany({ where: { createdById: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await cleanupCatalogContractFixture(db, fixture);
  });
});
async function chinese(page: Page) {
  expect(
    (
      await page.request.post("/api/account/preferences", {
        data: { locale: "zh-cn" },
      })
    ).status(),
  ).toBe(200);
}
async function publicList(
  request: APIRequestContext,
  kind: "courses" | "sections" | "teachers",
) {
  const search = fixture.marker;
  const base = `/api/catalog/${kind}?${new URLSearchParams({ search, pageSize: "1" })}`;
  const first = await request.get(base);
  expect(first.status()).toBe(200);
  const zh = await first.json();
  expect(zh.pagination.total).toBe(2);
  expect(zh.data).toHaveLength(1);
  const cookie = await createSignedSessionCookie(user.id);
  const withCookie = await request.get(base, {
    headers: {
      cookie: `${cookie.name}=${cookie.value}; NEXT_LOCALE=en-us`,
      "accept-language": "en-US,en;q=0.9",
    },
  });
  expect(await withCookie.json()).toEqual(zh);
  expect(withCookie.headers()["cache-control"]).toContain("public");
  expect(withCookie.headers().vary ?? "").not.toMatch(
    /cookie|accept-language/i,
  );
  const english = await request.get(`${base}&locale=en-us`, {
    headers: { cookie: "NEXT_LOCALE=zh-cn", "accept-language": "zh-CN" },
  });
  const en = await english.json();
  const localized = (row: {
    namePrimary?: string;
    course?: { namePrimary: string };
  }) => (kind === "sections" ? row.course?.namePrimary : row.namePrimary);
  expect(localized(en.data[0])).toMatch(
    kind === "teachers" ? /Same Name Teacher/ : /Contract Course/,
  );
  expect(localized(zh.data[0])).toMatch(
    kind === "teachers" ? /同名教师/ : /契约课程/,
  );
  const second = await request.get(`${base}&page=2`);
  const page2 = await second.json();
  expect(page2.pagination.total).toBe(2);
  expect(page2.data).toHaveLength(1);
  expect(page2.data[0].id).not.toBe(zh.data[0].id);
  const filter =
    kind === "courses"
      ? `jwIds=${fixture.courses[0].jwId}`
      : kind === "sections"
        ? `courseJwId=${fixture.courses[0].jwId}`
        : `departmentId=${fixture.departments[0].id}`;
  const filteredUrl = new URL(base, "http://localhost");
  if (kind === "courses")
    filteredUrl.searchParams.set("search", fixture.courses[0].code);
  else
    for (const [key, value] of new URLSearchParams(filter))
      filteredUrl.searchParams.set(key, value);
  const filtered = await request.get(filteredUrl.pathname + filteredUrl.search);
  expect((await filtered.json()).pagination.total).toBe(1);
}
test("course.public-list-cache", ({ request }) =>
  publicList(request, "courses"));
test("section.public-list-cache", ({ request }) =>
  publicList(request, "sections"));
test("teacher.public-list-cache", ({ request }) =>
  publicList(request, "teachers"));

async function canonical(page: Page, path: string, name: string) {
  await chinese(page);
  await gotoAndWaitForReady(page, `${path}?source=contract#overview`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  const root = new URL(path, page.url()).href;
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    root,
  );
  await expect(page).toHaveURL(
    new RegExp(`${path}\\?source=contract#overview$`),
  );
}
test("course.detail-canonical-url", ({ page }) =>
  canonical(
    page,
    `/catalog/courses/${fixture.courses[0].jwId}`,
    fixture.courses[0].nameCn,
  ));
test("section.detail-canonical-url", ({ page }) =>
  canonical(
    page,
    `/catalog/sections/${fixture.sections[0].jwId}`,
    fixture.courses[0].nameCn,
  ));
test("teacher.detail-canonical-url", ({ page }) =>
  canonical(
    page,
    `/catalog/teachers/${fixture.teachers[0].id}`,
    fixture.teachers[0].nameCn,
  ));

async function opaqueIdentity(page: Page, kind: "courses" | "sections") {
  await chinese(page);
  const entity = kind === "courses" ? fixture.courses[0] : fixture.sections[0];
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoAndWaitForReady(
      page,
      `/catalog/${kind}?search=${encodeURIComponent(fixture.courses[0].nameCn)}`,
    );
    const link = page
      .locator(`a[href="/catalog/${kind}/${entity.jwId}"]:visible`)
      .first();
    await expect(link).toBeVisible();
    expect(await page.locator("#main-content").innerText()).not.toContain(
      String(entity.jwId),
    );
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      fixture.courses[0].nameCn,
    );
    expect(await page.locator("#main-content").innerText()).not.toContain(
      String(entity.jwId),
    );
  }
}
test("course.jwid-url-only", ({ page }) => opaqueIdentity(page, "courses"));
test("section.jwid-url-only", ({ page }) => opaqueIdentity(page, "sections"));

test("teacher.identified-by-name", async ({ page }) => {
  await chinese(page);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoAndWaitForReady(
      page,
      `/catalog/teachers?search=${encodeURIComponent(fixture.teachers[0].nameCn)}`,
    );
    for (const [index, teacher] of fixture.teachers.entries()) {
      const row =
        width < 768
          ? page.locator(`a[href="/catalog/teachers/${teacher.id}"]:visible`)
          : page
              .getByRole("row")
              .filter({
                has: page.locator(`a[href="/catalog/teachers/${teacher.id}"]`),
              })
              .filter({ visible: true });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(teacher.nameCn);
      await expect(row).toContainText(fixture.departments[index].nameCn);
      await expect(row).toContainText(fixture.titles[index].nameCn);
    }
  }
});

test("teacher.section-code-auxiliary", async ({ page }) => {
  await chinese(page);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await gotoAndWaitForReady(
      page,
      `/catalog/teachers/${fixture.teachers[0].id}`,
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      fixture.teachers[0].nameCn,
    );
    const history = page.locator("#sections");
    await expect(history).toContainText(fixture.courses[0].nameCn);
    const code = history
      .locator('[data-slot="catalog-code"]:visible')
      .filter({ hasText: fixture.sections[0].code });
    await expect(code).toBeVisible();
    expect(
      await code.evaluate((element) => getComputedStyle(element).fontFamily),
    ).toMatch(/mono/i);
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText(
      fixture.sections[0].code,
    );
  }
});

test("section.private-section-projection", async ({ page, request }) => {
  const homework = await withE2ePrisma(async (db) => {
    await db.userSectionSubscription.create({
      data: { userId: user.id, sectionId: fixture.sections[0].id },
    });
    return db.homework.create({
      data: {
        sectionId: fixture.sections[0].id,
        createdById: user.id,
        title: "Private completion contract",
        publishedAt: new Date(),
        homeworkCompletions: { create: { userId: user.id } },
      },
    });
  });
  const path = `/_internal/catalog/sections/${fixture.sections[0].jwId}/viewer?homeworkId=${homework.id}`;
  const anonymous = await request.get(path);
  expect(anonymous.status()).toBe(200);
  expect(await anonymous.json()).toMatchObject({
    viewer: { signedIn: false, isSubscribed: false },
  });
  await page.context().addCookies([await createSignedSessionCookie(user.id)]);
  // A session must not personalize either public HTML or Svelte page data.
  const publicPath = `/catalog/sections/${fixture.sections[0].jwId}`;
  for (const client of [request, page.request, request]) {
    const html = await client.get(publicPath);
    expect(html.status()).toBe(200);
    expect(await html.text()).not.toContain(user.id);
    const response = await client.get(`${publicPath}/__data.json`);
    expect(response.status()).toBe(200);
    const envelope = await response.json();
    const data = Object.assign(
      {},
      ...envelope.nodes
        .filter((node: { type: string } | null) => node?.type === "data")
        .map((node: { data: unknown[] }) => unflatten(node.data)),
    );
    expect(data.user).toBeNull();
    expect(data.viewer).toEqual({ signedIn: false, isSubscribed: false });
    expect(data.homeworkData).toEqual({
      auditLogs: [],
      homeworks: [],
      viewer: {
        isAdmin: false,
        isAuthenticated: false,
        isSuspended: false,
        userId: null,
      },
    });
    expect(data.descriptionData.viewer).toMatchObject({
      userId: null,
      isAuthenticated: false,
      isAdmin: false,
    });
  }
  const projection = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(
        `/sections/${fixture.sections[0].jwId}/viewer`,
      ) && response.ok(),
  );
  await gotoAndWaitForReady(
    page,
    `/catalog/sections/${fixture.sections[0].jwId}?homeworkId=${homework.id}`,
  );
  const own = await projection;
  expect(own.headers()["cache-control"]).toBe("private, no-store");
  expect(own.headers()["cloudflare-cdn-cache-control"]).toBe("no-store");
  expect(own.headers().vary).toBe("Cookie");
  const body = await own.json();
  expect(body.viewer).toEqual({ signedIn: true, isSubscribed: true });
  expect(body.homeworkData.viewer).toMatchObject({
    userId: user.id,
    isAuthenticated: true,
    isAdmin: false,
    isSuspended: false,
  });
  expect(
    body.homeworkData.homeworks.find(
      (row: { id: string }) => row.id === homework.id,
    ).completion,
  ).not.toBeNull();
  const bearer = await page.request.get(path, {
    headers: { authorization: "Bearer unsupported" },
  });
  expect(bearer.status()).toBe(401);
  expect(bearer.headers()["cache-control"]).toBe("private, no-store");
  const openapi = await request.get("/api/openapi");
  expect(
    Object.keys((await openapi.json()).paths).some(
      (path) => path.includes("/_internal/") || path.includes("/viewer"),
    ),
  ).toBe(false);
  const again = await request.get(`${path}&userId=${user.id}`);
  expect(await again.json()).toMatchObject({
    viewer: { signedIn: false, isSubscribed: false },
  });
});

test("section.personal-deep-link-gate", async ({ page }) => {
  await page.context().addCookies([await createSignedSessionCookie(user.id)]);
  await chinese(page);
  const endpoint = `**/_internal/catalog/sections/${fixture.sections[0].jwId}/viewer*`;
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered: () => void = () => {};
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  await page.route(endpoint, async (route) => {
    entered();
    await held;
    await route.continue();
  });
  const target = `/catalog/sections/${fixture.sections[0].jwId}?subscribe=1&homeworkId=missing-homework`;
  await page.goto(target);
  await reached;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('form[action="?/subscribe"]')).toHaveCount(0);
  expect(
    await withE2ePrisma((db) =>
      db.userSectionSubscription.count({
        where: { userId: user.id, sectionId: fixture.sections[0].id },
      }),
    ),
  ).toBe(0);
  const resolved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(
        `/sections/${fixture.sections[0].jwId}/viewer`,
      ) && response.ok(),
  );
  release();
  await resolved;
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "订阅教学班", exact: true }),
  ).toBeEnabled();
  await page.unroute(endpoint);
  await page.route(endpoint, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "fixture unavailable" }),
    }),
  );
  const failure = page.waitForResponse(
    (response) =>
      response.status() === 503 && response.url().includes("/viewer"),
  );
  await page.goto(target);
  await failure;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('form[action="?/subscribe"]')).toHaveCount(0);
  expect(
    await withE2ePrisma((db) =>
      db.userSectionSubscription.count({
        where: { userId: user.id, sectionId: fixture.sections[0].id },
      }),
    ),
  ).toBe(0);
});
