import { expect, type Page } from "@playwright/test";
import { unflatten } from "devalue";
import type { CatalogContractFixture } from "../../../../shared/catalog-contract-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import type { PreferenceFlow } from "../../../utils/preference-flow";
import { observeSectionDetailNavigation } from "../../../utils/section-detail-navigation";
import { test } from "./public-catalog-fixture";

async function chinese(page: Page, flow: PreferenceFlow) {
  const response = await flow.http(() =>
    page.request.post("/api/account/preferences", {
      headers: flow.headers,
      data: { locale: "zh-cn" },
    }),
  );
  expect(response.status()).toBe(200);
}
async function canonical(
  page: Page,
  path: string,
  name: string,
  flow: PreferenceFlow,
) {
  await chinese(page, flow);
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
test("course.detail-canonical-url", async ({
  page,
  catalog: { fixture },
  catalogFlow,
}) => {
  await catalogFlow.run(() =>
    canonical(
      page,
      `/catalog/courses/${fixture.courses[0].jwId}`,
      fixture.courses[0].nameCn,
      catalogFlow,
    ),
  );
});
test("section.detail-canonical-url", async ({
  page,
  catalog: { fixture },
  catalogFlow,
}) => {
  await catalogFlow.run(() =>
    canonical(
      page,
      `/catalog/sections/${fixture.sections[0].jwId}`,
      fixture.courses[0].nameCn,
      catalogFlow,
    ),
  );
});
test("teacher.detail-canonical-url", async ({
  page,
  catalog: { fixture },
  catalogFlow,
}) => {
  await catalogFlow.run(() =>
    canonical(
      page,
      `/catalog/teachers/${fixture.teachers[0].id}`,
      fixture.teachers[0].nameCn,
      catalogFlow,
    ),
  );
});

async function opaqueIdentity(
  page: Page,
  kind: "courses" | "sections",
  fixture: CatalogContractFixture,
  flow: PreferenceFlow,
) {
  await chinese(page, flow);
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
    const expectSectionDetailReady =
      kind === "sections"
        ? observeSectionDetailNavigation(page, flow, entity.jwId)
        : undefined;
    await link.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      fixture.courses[0].nameCn,
    );
    if (expectSectionDetailReady) await expectSectionDetailReady();
    expect(await page.locator("#main-content").innerText()).not.toContain(
      String(entity.jwId),
    );
  }
}
test("course.jwid-url-only", async ({
  page,
  catalog: { fixture },
  catalogFlow,
}) => {
  await catalogFlow.run(() =>
    opaqueIdentity(page, "courses", fixture, catalogFlow),
  );
});
test("section.jwid-url-only", async ({
  page,
  catalog: { fixture },
  catalogFlow,
}) => {
  await catalogFlow.run(() =>
    opaqueIdentity(page, "sections", fixture, catalogFlow),
  );
});

test("teacher.identified-by-name", async ({
  page,
  catalog: { fixture },
  catalogFlow: flow,
}) => {
  await flow.run(async () => {
    await chinese(page, flow);
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
                  has: page.locator(
                    `a[href="/catalog/teachers/${teacher.id}"]`,
                  ),
                })
                .filter({ visible: true });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText(teacher.nameCn);
        await expect(row).toContainText(fixture.departments[index].nameCn);
        await expect(row).toContainText(fixture.titles[index].nameCn);
      }
    }
  });
});

test("teacher.section-code-auxiliary", async ({
  page,
  catalog: { fixture },
  catalogFlow: flow,
}) => {
  await flow.run(async () => {
    await chinese(page, flow);
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
});

test("section.private-section-projection", async ({
  page,
  request,
  catalog: { fixture, user },
  isolatedWorker,
  catalogFlow: flow,
}) => {
  await flow.run(async () => {
    const homework = await isolatedWorker.database.owner.$transaction(
      async (db) => {
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
      },
    );
    const path = `/_internal/catalog/sections/${fixture.sections[0].jwId}/viewer?homeworkId=${homework.id}`;
    const anonymous = await flow.http(() =>
      request.get(path, { headers: flow.headers }),
    );
    expect(anonymous.status()).toBe(200);
    expect(await anonymous.json()).toMatchObject({
      viewer: { signedIn: false, isSubscribed: false },
    });
    await page
      .context()
      .addCookies([(await isolatedWorker.createSession(user.id)).cookie]);
    // A session must not personalize either public HTML or Svelte page data.
    const publicPath = `/catalog/sections/${fixture.sections[0].jwId}`;
    for (const client of [request, page.request, request]) {
      const html = await flow.http(() =>
        client.get(publicPath, { headers: flow.headers }),
      );
      expect(html.status()).toBe(200);
      expect(await html.text()).not.toContain(user.id);
      const response = await flow.http(() =>
        client.get(`${publicPath}/__data.json`, { headers: flow.headers }),
      );
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
    // The flow owns this event wait even if the subsequent navigation fails.
    const projection = flow.waitForResponse(
      page,
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
    const bearer = await flow.http(() =>
      page.request.get(path, {
        headers: { ...flow.headers, authorization: "Bearer unsupported" },
      }),
    );
    expect(bearer.status()).toBe(401);
    expect(bearer.headers()["cache-control"]).toBe("private, no-store");
    const openapi = await flow.http(() =>
      request.get("/api/openapi", { headers: flow.headers }),
    );
    expect(
      Object.keys((await openapi.json()).paths).some(
        (path) => path.includes("/_internal/") || path.includes("/viewer"),
      ),
    ).toBe(false);
    const again = await flow.http(() =>
      request.get(`${path}&userId=${user.id}`, { headers: flow.headers }),
    );
    expect(await again.json()).toMatchObject({
      viewer: { signedIn: false, isSubscribed: false },
    });
  });
});

test("section.personal-deep-link-gate", async ({
  page,
  catalog: { fixture, user },
  isolatedWorker,
  catalogFlow: flow,
}) => {
  await flow.run(async () => {
    await page
      .context()
      .addCookies([(await isolatedWorker.createSession(user.id)).cookie]);
    await chinese(page, flow);
    const endpoint = `**/_internal/catalog/sections/${fixture.sections[0].jwId}/viewer*`;
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => {};
    const reached = new Promise<void>((resolve) => {
      entered = resolve;
    });
    flow.onClosing(() => {
      release();
      entered();
    });
    await flow.route(page, endpoint, async (route) => {
      entered();
      await held;
      await route.continue({
        headers: { ...route.request().headers(), ...flow.headers },
      });
    });
    const target = `/catalog/sections/${fixture.sections[0].jwId}?subscribe=1&homeworkId=missing-homework`;
    await page.goto(target);
    await reached;
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator('form[action="?/subscribe"]')).toHaveCount(0);
    expect(
      await isolatedWorker.database.owner.userSectionSubscription.count({
        where: { userId: user.id, sectionId: fixture.sections[0].id },
      }),
    ).toBe(0);
    const resolved = flow.waitForResponse(
      page,
      (response) =>
        new URL(response.url()).pathname.endsWith(
          `/sections/${fixture.sections[0].jwId}/viewer`,
        ) && response.ok(),
    );
    release();
    await (await resolved).body();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "订阅教学班", exact: true }),
    ).toBeEnabled();
    await flow.clearRoutes(page);
    // Deliberate browser-side failure: no native request is claimed for this 503.
    await flow.route(page, endpoint, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "fixture unavailable" }),
      }),
    );
    const failure = flow.waitForResponse(
      page,
      (response) =>
        response.status() === 503 && response.url().includes("/viewer"),
    );
    await page.goto(target);
    await (await failure).body();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator('form[action="?/subscribe"]')).toHaveCount(0);
    expect(
      await isolatedWorker.database.owner.userSectionSubscription.count({
        where: { userId: user.id, sectionId: fixture.sections[0].id },
      }),
    ).toBe(0);
  });
});
