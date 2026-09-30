import { expect, type Page } from "@playwright/test";
import type { IsolatedWorker } from "../../../../utils/isolated-worker";
import { test as preferenceTest } from "../../../../utils/personal-preferences-fixture";
import type { PreferenceFlow } from "../../../../utils/preference-flow";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

const viewerPath = "/_internal/catalog/links/viewer";
const pinPath = "/api/workspace/link-pins";
const pinForms = `form[action="${pinPath}"]`;

async function arrangeLinkState(isolatedWorker: IsolatedWorker) {
  const db = isolatedWorker.database.owner;
  const users = await db.$transaction(async (transaction) => {
    const users: string[] = [];
    for (const index of [0, 1]) {
      const marker = `link-contract-${index}-${crypto.randomUUID().slice(0, 8)}`;
      const user = await transaction.user.create({
        data: {
          name: marker,
          username: marker,
          email: `${marker}@example.test`,
          emailVerified: true,
          workspaceLinkPins: { create: {
            slug: index === 0 ? "jw" : "vlab",
            // The initial jw pin is unambiguously older than all real API pins.
            createdAt: new Date("2020-01-01T00:00:00.000Z"),
          } },
          catalogLinkClicks: { create: { slug: "jw", count: index === 0 ? 7654321 : 8765432 } },
        },
      });
      users.push(user.id);
    }
    return users;
  });
  let failureTrigger: string | undefined;
  return {
    users,
    state: async () => ({
      pins: await db.workspaceLinkPin.findMany({
        where: { userId: { in: users } },
        orderBy: [{ userId: "asc" }, { slug: "asc" }],
      }),
      clicks: await db.catalogLinkClick.findMany({
        where: { userId: { in: users } },
        orderBy: [{ userId: "asc" }, { slug: "asc" }],
      }),
    }),
    session: async (userId: string) => (await isolatedWorker.createSession(userId)).cookie,
    injectFailure: async () => {
      const name = `link_failure_${crypto.randomUUID().replaceAll("-", "")}`;
      await db.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(
          `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (TG_OP = 'DELETE' AND OLD."userId" = '${users[0]}') OR (TG_OP <> 'DELETE' AND NEW."userId" = '${users[0]}') THEN RAISE EXCEPTION 'isolated pin persistence failure'; END IF; IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$`,
        );
        await transaction.$executeRawUnsafe(
          `CREATE TRIGGER ${name} BEFORE INSERT OR UPDATE OR DELETE ON "WorkspaceLinkPin" FOR EACH ROW EXECUTE FUNCTION ${name}()`,
        );
      });
      failureTrigger = name;
    },
    removeFailureTrigger: async () => {
      if (!failureTrigger) throw new Error("No owned link failure trigger");
      const name = failureTrigger;
      await db.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(`DROP TRIGGER ${name} ON "WorkspaceLinkPin"`);
        await transaction.$executeRawUnsafe(`DROP FUNCTION ${name}()`);
      });
      failureTrigger = undefined;
    },
  };
}

const test = preferenceTest.extend<{ linkState: Awaited<ReturnType<typeof arrangeLinkState>> }>({
  linkState: async ({ isolatedWorker, page, run, preferenceFlow: _flow }, use) => {
    const fixture = await run(async () => {
      const fixture = await arrangeLinkState(isolatedWorker);
      await page.context().addCookies([await fixture.session(fixture.users[0])]);
      return fixture;
    });
    // The private database owns the trigger even if its creation or test fails;
    // successful recovery removes it explicitly before retrying the real UI.
    await use(fixture);
  },
});

function form(page: Page, slug: string) {
  return page
    .locator(pinForms)
    .filter({ has: page.locator(`input[name="slug"][value="${slug}"]`) })
    .filter({ visible: true })
    .first();
}
async function locale(page: Page, value: string, origin: string, preferenceFlow: PreferenceFlow) {
  expect(
    (
      await preferenceFlow.http(() => page.request.post("/api/account/preferences", { headers: preferenceFlow.headers,
        data: { locale: value },
      }))
    ).status(),
  ).toBe(200);
  await page
    .context()
    .addCookies([{ name: "NEXT_LOCALE", value, url: origin }]);
}

test("catalog-link.pin-limit", async ({ preferenceFlow, linkState, page }) => {
  await preferenceFlow.run(async () => {
    const { users, state } = linkState;
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
      const response = await preferenceFlow.http(() => page.request.post(pinPath, {
        form: { slug, action, returnTo: "/catalog/links" },
        headers: { ...preferenceFlow.headers,  accept: "application/json" },
      }));
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
  }, "pins");
});

test("catalog-link.public-web-personal-overlay", async ({ preferenceFlow, linkState, isolatedWorker,
  page,
  request,
}) => {
  await preferenceFlow.run(async () => {
    const { users } = linkState;
    for (const [index, userId] of users.entries()) {
      const session = await linkState.session(userId);
      const context = await preferenceFlow.newContext({
        baseURL: isolatedWorker.origin,
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
        const overlay = await preferenceFlow.http(() => context.request.get(viewerPath, { headers: preferenceFlow.headers }));
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
            await preferenceFlow.http(() => context.request.get(viewerPath, {
              headers: { ...preferenceFlow.headers,  authorization: "Bearer unsupported-session-token" },
            }))
          ).status(),
        ).toBe(401);
      } finally {
        await preferenceFlow.closeContext(context);
      }
    }
    const anonymous = await preferenceFlow.http(() => request.get(viewerPath, { headers: preferenceFlow.headers }));
    expect(anonymous.headers()["cache-control"]).toBe("private, no-store");
    expect(await anonymous.json()).toEqual({ signedIn: false, links: null });
    await gotoAndWaitForReady(page, "/catalog/links");
    await expect(form(page, "jw").locator('input[name="action"]')).toHaveValue(
      "unpin",
    );
    await expect(form(page, "vlab").locator('input[name="action"]')).toHaveValue(
      "pin",
    );
  }, "consume");
});

test("catalog-link.pin-write-gate", async ({ preferenceFlow, linkState, page }) => {
  await preferenceFlow.run(async () => {
    const { users, state } = linkState;
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
    preferenceFlow.onClosing(release);
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname === pinPath &&
        request.method() === "POST"
      )
        writes += 1;
    });
    await preferenceFlow.route(page, `**${viewerPath}`, async (route) => {
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
    const savedResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === pinPath && response.request().method() === "POST",
    );
    await form(page, "jw").getByRole("button").click();
    const saved = await savedResponse;
    expect(saved.status()).toBe(200);
    expect(await saved.json()).toMatchObject({ pinnedSlugs: [], error: null });
    await expect(form(page, "jw").locator('input[name="action"]')).toHaveValue(
      "pin",
    );
    expect(writes).toBe(1);
    expect((await state()).pins.filter((pin) => pin.userId === users[0])).toEqual(
      [],
    );
  }, "pins");
});

test("catalog-link.pin-error-clear", async ({ preferenceFlow, linkState, isolatedWorker, page }) => {
  await preferenceFlow.run(async () => {
    const { state } = linkState;
    await linkState.injectFailure();
    const before = await state();
    for (const language of ["zh-cn", "en-us"]) {
      await locale(page, language, isolatedWorker.origin, preferenceFlow);
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
      await preferenceFlow.route(page, "**/api/workspace/link-pins", async (route) => {
        await route.fallback({
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
      await preferenceFlow.clearRoutes(page);
    }
    await linkState.removeFailureTrigger();
    const recoveredResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === pinPath && response.request().method() === "POST",
    );
    await form(page, "vlab").getByRole("button").click();
    const recovered = await recoveredResponse;
    expect(recovered.status()).toBe(200);
    expect(await recovered.json()).toMatchObject({ pinnedSlugs: ["jw", "vlab"], error: null });
    await expect.poll(async () => (await state()).pins.filter((pin) => pin.userId === linkState.users[0]).map((pin) => pin.slug)).toEqual(["jw", "vlab"]);
    await expect(form(page, "vlab").locator('input[name="action"]')).toHaveValue(
      "unpin",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
  }, "pins");
});

test("catalog-link.visit-tracking-link", async ({ preferenceFlow, linkState, isolatedWorker }) => {
  await preferenceFlow.run(async () => {
    const { users, state } = linkState;
    const before = await state();
    for (const signedIn of [false, true]) {
      const context = await preferenceFlow.newContext({ baseURL: isolatedWorker.origin });
      try {
        if (signedIn)
          await context.addCookies([await linkState.session(users[0])]);
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
            new URL(link.href ?? "", isolatedWorker.origin).searchParams.get(
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
        await preferenceFlow.route(context,
          "**/api/catalog/links/resolve?slug=jw",
          async (route) => {
            const response = await route.fetch({ maxRedirects: 0 });
            expect(response.status()).toBe(307);
            expect(response.headers().location).toBe("https://jw.ustc.edu.cn/");
            await response.body();
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
          `${isolatedWorker.origin}/api/catalog/links/resolve?slug=jw`,
        );
        await expect(destination.locator("body")).toContainText(
          "Verified visit redirect",
        );
        const after = await state();
        expect(after.pins).toEqual(before.pins);
        expect(after.clicks.find((click) => click.userId === users[0])?.count).toBe(7654321 + Number(signedIn));
        expect(after.clicks.find((click) => click.userId === users[1])?.count).toBe(8765432);
      } finally {
        await preferenceFlow.closeContext(context);
      }
    }
  }, "visits");
});

test("catalog-link.visit-owner-count", async ({ preferenceFlow, linkState, isolatedWorker, page, request }) => {
  await preferenceFlow.run(async () => {
    const { users, state } = linkState;
    const before = await state();
    const url = "/api/catalog/links/resolve?slug=jw";
    const anonymous = await preferenceFlow.http(() => request.get(url, { headers: preferenceFlow.headers,  maxRedirects: 0 }));
    expect(anonymous.status()).toBe(307);
    expect(anonymous.headers().location).toBe("https://jw.ustc.edu.cn/");
    expect(await state()).toEqual(before);
    for (const [index, userId] of users.entries()) {
      const context = await preferenceFlow.newContext({ baseURL: isolatedWorker.origin });
      try {
        await context.addCookies([await linkState.session(userId)]);
        for (const increment of [1, 2]) {
          const response = await preferenceFlow.http(() => context.request.get(
            `${url}&userId=${users[1 - index]}`, { headers: preferenceFlow.headers,  maxRedirects: 0 }));
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
        await preferenceFlow.closeContext(context);
      }
    }
    await page.context().clearCookies();
  }, "visits");
});
