import { expect, type Page, test } from "@playwright/test";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";

let users: string[];
let failureTrigger: string | undefined;
const viewerPath = "/_internal/catalog/links/viewer";
const pinPath = "/api/workspace/link-pins";
const pinForms = `form[action="${pinPath}"]`;

test.beforeEach(async ({ page }) => {
  failureTrigger = undefined;
  users = [];
  await withE2ePrisma(async (db) => {
    for (const index of [0, 1]) {
      const marker = `link-contract-${index}-${crypto.randomUUID().slice(0, 8)}`;
      const user = await db.user.create({
        data: {
          name: marker,
          username: marker,
          email: `${marker}@example.test`,
          emailVerified: true,
        },
      });
      users.push(user.id);
      await db.workspaceLinkPin.create({
        data: { userId: user.id, slug: index === 0 ? "jw" : "vlab" },
      });
      await db.catalogLinkClick.create({
        data: {
          userId: user.id,
          slug: "jw",
          count: index === 0 ? 7654321 : 8765432,
        },
      });
    }
  });
  await page.context().clearCookies();
  await page.context().addCookies([await createSignedSessionCookie(users[0])]);
});

async function removeFailureTrigger() {
  if (!failureTrigger) return;
  const name = failureTrigger;
  await withE2ePrisma(async (db) => {
    await db.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS ${name} ON "WorkspaceLinkPin"`,
    );
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${name}()`);
  });
  failureTrigger = undefined;
}

test.afterEach(async () => {
  await removeFailureTrigger();
  await withE2ePrisma((db) =>
    db.user.deleteMany({ where: { id: { in: users } } }),
  );
});

function form(page: Page, slug: string) {
  return page
    .locator(pinForms)
    .filter({ has: page.locator(`input[name="slug"][value="${slug}"]`) })
    .filter({ visible: true })
    .first();
}
async function state() {
  return withE2ePrisma(async (db) => ({
    pins: await db.workspaceLinkPin.findMany({
      where: { userId: { in: users } },
      orderBy: [{ userId: "asc" }, { slug: "asc" }],
    }),
    clicks: await db.catalogLinkClick.findMany({
      where: { userId: { in: users } },
      orderBy: [{ userId: "asc" }, { slug: "asc" }],
    }),
  }));
}
async function locale(page: Page, value: string) {
  expect(
    (
      await page.request.post("/api/account/preferences", {
        data: { locale: value },
      })
    ).status(),
  ).toBe(200);
  await page
    .context()
    .addCookies([{ name: "NEXT_LOCALE", value, url: PLAYWRIGHT_BASE_URL }]);
}

test("catalog-link.pin-limit", async ({ page }) => {
  const foreignBefore = (await state()).pins.filter(
    (pin) => pin.userId === users[1],
  );
  const originalJw = (await state()).pins.find(
    (pin) => pin.userId === users[0] && pin.slug === "jw",
  );
  const apply = async (
    slug: string,
    action: "pin" | "unpin",
    expected: string[],
  ) => {
    const response = await page.request.post(pinPath, {
      form: { slug, action, returnTo: "/catalog/links" },
      headers: { accept: "application/json" },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.maxPinnedLinks).toBe(4);
    expect(body.error).toBeNull();
    expect(body.pinnedSlugs.toSorted()).toEqual(expected.toSorted());
    const after = await state();
    expect(
      after.pins
        .filter((pin) => pin.userId === users[0])
        .map((pin) => pin.slug)
        .toSorted(),
    ).toEqual(expected.toSorted());
    expect(after.pins.filter((pin) => pin.userId === users[1])).toEqual(
      foreignBefore,
    );
  };
  await apply("mail", "pin", ["jw", "mail"]);
  await apply("icourse", "pin", ["jw", "mail", "icourse"]);
  await apply("library", "pin", ["jw", "mail", "icourse", "library"]);
  await apply("jw", "pin", ["jw", "mail", "icourse", "library"]);
  expect(
    (await state()).pins.find(
      (pin) => pin.userId === users[0] && pin.slug === "jw",
    )?.createdAt,
  ).toEqual(originalJw?.createdAt);
  await apply("vlab", "pin", ["mail", "icourse", "library", "vlab"]);
  await apply("vlab", "pin", ["mail", "icourse", "library", "vlab"]);
  await apply("mail", "unpin", ["icourse", "library", "vlab"]);
  await apply("jw", "pin", ["icourse", "library", "vlab", "jw"]);
  await apply("official", "pin", ["library", "vlab", "jw", "official"]);
  await gotoAndWaitForReady(page, "/catalog/links");
  for (const slug of ["library", "vlab", "jw", "official"])
    await expect(form(page, slug).locator('input[name="action"]')).toHaveValue(
      "unpin",
    );
  for (const slug of ["mail", "icourse"])
    await expect(form(page, slug).locator('input[name="action"]')).toHaveValue(
      "pin",
    );
});

test("catalog-link.public-web-personal-overlay", async ({
  page,
  browser,
  request,
}) => {
  for (const [index, userId] of users.entries()) {
    const session = await createSignedSessionCookie(userId);
    const context = await browser.newContext({
      baseURL: PLAYWRIGHT_BASE_URL,
      javaScriptEnabled: false,
    });
    try {
      await context.addCookies([session]);
      const ssr = await context.newPage();
      const response = await ssr.goto("/catalog/links");
      expect(response?.status()).toBe(200);
      if (!response) throw new Error("Missing HTML response");
      const html = await response.text();
      for (const privateValue of [...users, "7654321", "8765432"])
        expect(html).not.toContain(privateValue);
      await expect(ssr.locator(pinForms)).toHaveCount(0);
      await expect(
        ssr
          .locator('a[href="/api/catalog/links/resolve?slug=jw"]')
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      const overlay = await context.request.get(viewerPath);
      expect(overlay.status()).toBe(200);
      expect(overlay.headers()["cache-control"]).toBe("private, no-store");
      const body = await overlay.json();
      expect(body.signedIn).toBe(true);
      expect(
        body.links
          .filter((link: { isPinned: boolean }) => link.isPinned)
          .map((link: { slug: string }) => link.slug),
      ).toEqual([index === 0 ? "jw" : "vlab"]);
      expect(
        body.links.find((link: { slug: string }) => link.slug === "jw")
          .clickCount,
      ).toBe(index === 0 ? 7654321 : 8765432);
      expect(
        (
          await context.request.get(viewerPath, {
            headers: { authorization: "Bearer unsupported-session-token" },
          })
        ).status(),
      ).toBe(401);
    } finally {
      await context.close();
    }
  }
  const anonymous = await request.get(viewerPath);
  expect(anonymous.headers()["cache-control"]).toBe("private, no-store");
  expect(await anonymous.json()).toEqual({ signedIn: false, links: null });
  await gotoAndWaitForReady(page, "/catalog/links");
  await expect(form(page, "jw").locator('input[name="action"]')).toHaveValue(
    "unpin",
  );
  await expect(form(page, "vlab").locator('input[name="action"]')).toHaveValue(
    "pin",
  );
});

test("catalog-link.pin-write-gate", async ({ page }) => {
  const before = await state();
  let reads = 0;
  let writes = 0;
  let release!: () => void;
  let received!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    received = resolve;
  });
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === pinPath &&
      request.method() === "POST"
    )
      writes += 1;
  });
  await page.route(`**${viewerPath}`, async (route) => {
    reads += 1;
    if (reads === 1) {
      received();
      await held;
      await route.fulfill({ status: 503, json: { error: "unavailable" } });
    } else await route.continue();
  });
  try {
    await page.goto("/catalog/links", { waitUntil: "domcontentloaded" });
    await requested;
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(page.locator(pinForms)).toHaveCount(0);
    await page.getByRole("searchbox").fill("jw.ustc.edu.cn");
    expect(writes).toBe(0);
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: /^(重试|Retry)$/ }),
  ).toBeVisible();
  await expect(page.locator(pinForms)).toHaveCount(0);
  expect(writes).toBe(0);
  expect(await state()).toEqual(before);
  await page.getByRole("button", { name: /^(重试|Retry)$/ }).click();
  await expect(form(page, "jw").getByRole("button")).toBeEnabled();
  expect(reads).toBe(2);
  expect(writes).toBe(0);
  await form(page, "jw").getByRole("button").click();
  await expect(form(page, "jw").locator('input[name="action"]')).toHaveValue(
    "pin",
  );
  expect(writes).toBe(1);
  expect((await state()).pins.filter((pin) => pin.userId === users[0])).toEqual(
    [],
  );
});

test("catalog-link.pin-error-clear", async ({ page }) => {
  failureTrigger = `link_failure_${crypto.randomUUID().replaceAll("-", "")}`;
  await withE2ePrisma(async (db) => {
    await db.$executeRawUnsafe(
      `CREATE FUNCTION ${failureTrigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (TG_OP = 'DELETE' AND OLD."userId" = '${users[0]}') OR (TG_OP <> 'DELETE' AND NEW."userId" = '${users[0]}') THEN RAISE EXCEPTION 'isolated pin persistence failure'; END IF; IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER ${failureTrigger} BEFORE INSERT OR UPDATE OR DELETE ON "WorkspaceLinkPin" FOR EACH ROW EXECUTE FUNCTION ${failureTrigger}()`,
    );
  });
  const before = await state();
  for (const language of ["zh-cn", "en-us"]) {
    await locale(page, language);
    await gotoAndWaitForReady(page, "/catalog/links");
    for (const [slug, action] of [
      ["jw", "unpin"],
      ["vlab", "pin"],
    ]) {
      const target = form(page, slug);
      await expect(target.locator('input[name="action"]')).toHaveValue(action);
      const response = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === pinPath &&
          response.request().method() === "POST",
      );
      await target.getByRole("button").click();
      const failed = await response;
      expect(failed.status()).toBe(500);
      expect(await failed.json()).toMatchObject({
        error: "Failed to update workspace link pin state",
        pinnedSlugs: [],
      });
      await expect(page.getByRole("alert")).toContainText(
        language === "zh-cn" ? "置顶更新失败" : "Pin update failed",
      );
      await expect(target.locator('input[name="action"]')).toHaveValue(action);
      await expect(target.getByRole("button")).toBeEnabled();
      expect(await state()).toEqual(before);
    }
    // A stale client catalog sends a slug no longer present in the current catalog.
    await page.route("**/api/workspace/link-pins", async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          "content-type": "application/x-www-form-urlencoded",
        },
        postData: new URLSearchParams({
          slug: "unknown-test-link",
          action: "pin",
          returnTo: "/catalog/links",
        }).toString(),
      });
    });
    const response = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === pinPath &&
        response.request().method() === "POST",
    );
    await form(page, "vlab").getByRole("button").click();
    const failed = await response;
    expect(failed.status()).toBe(400);
    expect(await failed.json()).toMatchObject({
      error: "invalid_slug",
      pinnedSlugs: ["jw"],
    });
    await expect(page.getByRole("alert")).toContainText(
      language === "zh-cn" ? "置顶更新失败" : "Pin update failed",
    );
    await expect(form(page, "jw").locator('input[name="action"]')).toHaveValue(
      "unpin",
    );
    await expect(
      form(page, "vlab").locator('input[name="action"]'),
    ).toHaveValue("pin");
    expect(await state()).toEqual(before);
    await page.unroute("**/api/workspace/link-pins");
  }
  await removeFailureTrigger();
  await form(page, "vlab").getByRole("button").click();
  await expect(form(page, "vlab").locator('input[name="action"]')).toHaveValue(
    "unpin",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("catalog-link.visit-tracking-link", async ({ browser }) => {
  for (const signedIn of [false, true]) {
    const context = await browser.newContext({ baseURL: PLAYWRIGHT_BASE_URL });
    try {
      if (signedIn)
        await context.addCookies([await createSignedSessionCookie(users[0])]);
      const target = await context.newPage();
      await gotoAndWaitForReady(target, "/catalog/links");
      const links = target.locator(
        'a[href^="/api/catalog/links/resolve?slug="]',
      );
      const attributes = await links.evaluateAll((elements) =>
        elements.map((element) => ({
          href: element.getAttribute("href"),
          role: element.getAttribute("role"),
          target: element.getAttribute("target"),
        })),
      );
      expect(attributes.length).toBeGreaterThan(10);
      for (const link of attributes) {
        expect(
          new URL(link.href ?? "", PLAYWRIGHT_BASE_URL).searchParams.get(
            "slug",
          ),
        ).toBeTruthy();
        expect(link.role).not.toBe("button");
        expect(link.target).toBe("_blank");
      }
      const clicked = context.waitForEvent("request", {
        predicate: (request) =>
          new URL(request.url()).pathname === "/api/catalog/links/resolve",
      });
      const popup = target.waitForEvent("popup");
      await context.route(
        "**/api/catalog/links/resolve?slug=jw",
        async (route) => {
          const response = await route.fetch({ maxRedirects: 0 });
          expect(response.status()).toBe(307);
          expect(response.headers().location).toBe("https://jw.ustc.edu.cn/");
          await route.fulfill({
            status: 200,
            contentType: "text/plain",
            body: "Verified visit redirect",
          });
        },
      );
      await links
        .filter({ hasText: /教务系统|Academic Affairs System/ })
        .filter({ visible: true })
        .first()
        .click();
      expect((await clicked).method()).toBe("GET");
      const destination = await popup;
      await expect(destination).toHaveURL(
        `${PLAYWRIGHT_BASE_URL}/api/catalog/links/resolve?slug=jw`,
      );
      await expect(destination.locator("body")).toContainText(
        "Verified visit redirect",
      );
    } finally {
      await context.close();
    }
  }
});

test("catalog-link.visit-owner-count", async ({ page, browser, request }) => {
  const before = await state();
  const url = "/api/catalog/links/resolve?slug=jw";
  const anonymous = await request.get(url, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(307);
  expect(anonymous.headers().location).toBe("https://jw.ustc.edu.cn/");
  expect(await state()).toEqual(before);
  for (const [index, userId] of users.entries()) {
    const context = await browser.newContext({ baseURL: PLAYWRIGHT_BASE_URL });
    try {
      await context.addCookies([await createSignedSessionCookie(userId)]);
      for (const increment of [1, 2]) {
        const response = await context.request.get(
          `${url}&userId=${users[1 - index]}`,
          { maxRedirects: 0 },
        );
        expect(response.status()).toBe(307);
        expect(response.headers().location).toBe("https://jw.ustc.edu.cn/");
        const after = await state();
        expect(after.pins).toEqual(before.pins);
        expect(
          after.clicks.find((click) => click.userId === userId)?.count,
        ).toBe((index === 0 ? 7654321 : 8765432) + increment);
        expect(
          after.clicks.find((click) => click.userId === users[1 - index])
            ?.count,
        ).toBe(index === 0 ? 8765432 : 7654323);
      }
    } finally {
      await context.close();
    }
  }
  await page.context().clearCookies();
});
