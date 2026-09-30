import {
  type APIResponse,
  test as browserTest,
  expect,
  type Request,
} from "@playwright/test";
import { unflatten } from "devalue";
import { restReadScope } from "@/lib/oauth/scope-registry";
import { DEV_SEED } from "../../../utils/dev-seed";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { test } from "./shell-projection-fixture";

function expectPrivate(response: APIResponse) {
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers()["cloudflare-cdn-cache-control"]).toBe("no-store");
  expect(response.headers().vary?.split(/,\s*/)).toContain("Cookie");
}

test("rendering-and-cache.cacheable-public-pages-14", async ({
  shell,
  page,
}) => {
  await shell.run(
    { incomplete: true, sessions: [{ user: 0 }, { user: 2 }, { user: 3 }] },
    async ({ users, flow, sessionCookie, incomplete }) => {
      const request = page.request;
      const contexts = [];
      for (const user of [users[0], ...incomplete]) {
        const context = await flow.newContext();
        contexts.push(context);
        await context.addCookies([await sessionCookie(user.id)]);
      }
      for (const locale of ["zh-cn", "en-us"]) {
        const headers = { "Accept-Language": locale };
        const anonymous = await request.get("/", { headers, maxRedirects: 0 });
        expect(anonymous.status()).toBe(200);
        expect(anonymous.headers()["content-type"]).toContain("text/html");
        for (const [index, context] of contexts.entries()) {
          const response = await context.request.get("/", {
            headers,
            maxRedirects: 0,
          });
          expect(response.status()).toBe(303);
          expect(response.headers().location).toBe(
            index === 0
              ? "/workspace/overview"
              : "/account/welcome?callbackUrl=%2F",
          );
          expect(response.headers()["cache-control"]).toBe("private, no-store");
          expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
            "no-store",
          );
          const dataRedirect = await context.request.get("/__data.json", {
            headers,
            maxRedirects: 0,
          });
          expect(dataRedirect.status()).toBe(200);
          expect(await dataRedirect.json()).toEqual({
            type: "redirect",
            location:
              index === 0
                ? "/workspace/overview"
                : "/account/welcome?callbackUrl=%2F",
          });
          expect(dataRedirect.headers()["cache-control"]).toBe(
            "private, no-store",
          );
          expect(dataRedirect.headers()["cloudflare-cdn-cache-control"]).toBe(
            "no-store",
          );
          const page = await context.newPage();
          await gotoAndWaitForReady(page, "/");
          await expect(page).toHaveURL(
            index === 0
              ? /\/workspace\/overview$/
              : /\/account\/welcome\?callbackUrl=%2F$/,
          );
          await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
          await flow.closePage(page);
        }
        const finalAnonymous = await request.get("/", {
          headers,
          maxRedirects: 0,
        });
        expect(finalAnonymous.status()).toBe(200);
        const html = await finalAnonymous.text();
        for (const user of [...users, ...incomplete]) {
          expect(html).not.toContain(user.id);
          expect(html).not.toContain(user.email);
        }
      }
    },
  );
});

test("rendering-and-cache.personal-overlays-4", async ({ shell, page }) => {
  await shell.run(
    { device: true, sessions: [{ user: 0 }, { user: 1 }] },
    async ({ users, flow, origin, sessionCookie, client, profileRead }) => {
      const request = page.request;
      if (!client) throw new Error("Shell device client is required");
      const anonymous = await request.get("/_internal/shell-bootstrap");
      expect(anonymous.status()).toBe(200);
      expectPrivate(anonymous);
      expect(await anonymous.json()).toEqual({
        viewer: null,
        navigation: null,
        subscribedSections: [],
      });
      for (const [index, user] of users.entries()) {
        const context = await flow.newContext();
        try {
          await context.addCookies([
            await sessionCookie(user.id),
            { name: "NEXT_LOCALE", value: "zh-cn", url: origin },
          ]);
          const response = await context.request.get(
            "/_internal/shell-bootstrap",
          );
          expect(response.status()).toBe(200);
          expectPrivate(response);
          const payload = await response.json();
          expect(payload.viewer).toEqual({
            id: user.id,
            name: user.name,
            username: user.username,
            image: null,
            isAdmin: false,
          });
          expect(payload.navigation).toMatchObject({
            userId: user.id,
            pendingTodosCount: index === 0 ? 2 : 0,
            subscribedSectionCount: index === 0 ? 1 : 0,
          });
          expect(Object.keys(payload.navigation).sort()).toEqual([
            "calendarItemsCount",
            "examsCount",
            "pendingHomeworksCount",
            "pendingTodosCount",
            "subscribedSectionCount",
            "unreadActivityNotificationsCount",
            "userId",
          ]);
          const page = await context.newPage();
          for (const path of [
            "/catalog/courses",
            "/account/settings/preferences",
          ]) {
            const bootstrap = page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname ===
                "/_internal/shell-bootstrap",
            );
            await gotoAndWaitForReady(page, path);
            const hydrated = await bootstrap;
            expect(hydrated.request().resourceType()).toBe("fetch");
            expect(hydrated.headers()["cache-control"]).toBe(
              "private, no-store",
            );
            expect(await hydrated.json()).toEqual(payload);
            await expect(page.locator("#app-user-menu")).toContainText(
              user.name,
            );
          }
          expect(JSON.stringify(payload)).not.toContain(user.email);
          expect(JSON.stringify(payload)).not.toContain(users[1 - index].id);
          const token = await authorizeDeviceBearer(
            context.request,
            origin,
            client.clientId,
            restReadScope("account.profile"),
          );
          const authorization = `Bearer ${token}`;
          await profileRead(user.id, async () => {
            const profile = await request.get("/api/account/profile", {
              headers: { authorization },
            });
            expect(profile.status()).toBe(200);
            expect(await profile.json()).toMatchObject({ id: user.id });
          });
          for (const transport of [request, context.request]) {
            const denied = await transport.get("/_internal/shell-bootstrap", {
              headers: { authorization },
            });
            expect(denied.status()).toBe(401);
            expectPrivate(denied);
            expect(await denied.json()).toEqual({
              error: "Session authentication required",
            });
          }
        } finally {
          await flow.closeContext(context);
        }
      }
    },
  );
});

test("rendering-and-cache.personal-overlays-5", async ({ shell }) => {
  await shell.run(
    { sessions: [{ user: 0 }, { user: 1 }] },
    async ({ users, flow, origin, sessionCookie }) => {
      for (const user of users) {
        const cookie = await sessionCookie(user.id);
        for (const javaScriptEnabled of [false, true]) {
          const context = await flow.newContext({
            javaScriptEnabled,
            viewport: { width: 1280, height: 900 },
          });
          try {
            await context.addCookies([
              cookie,
              { name: "NEXT_LOCALE", value: "en-us", url: origin },
            ]);
            const page = await context.newPage();
            const bootstrapRequests: string[] = [];
            page.on("request", (request) => {
              if (
                new URL(request.url()).pathname === "/_internal/shell-bootstrap"
              )
                bootstrapRequests.push(request.url());
            });
            const response = javaScriptEnabled
              ? await gotoAndWaitForReady(page, "/workspace/todos")
              : await page.goto("/workspace/todos");
            if (response) expect(response.status()).toBe(200);
            await expect(page.locator("#app-user-menu")).toContainText(
              user.name,
            );
            const projection = await context.request.get(
              "/_internal/shell-bootstrap",
            );
            expect(projection.status()).toBe(200);
            const payload = await projection.json();
            expect(payload.viewer.id).toBe(user.id);
            const navigation = page.locator(
              '[data-shell-navigation="desktop"]',
            );
            for (const [path, field] of [
              ["calendar", "calendarItemsCount"],
              ["homeworks", "pendingHomeworksCount"],
              ["todos", "pendingTodosCount"],
              ["exams", "examsCount"],
              ["subscriptions", "subscribedSectionCount"],
            ] as const) {
              const link = navigation.locator(`a[href="/workspace/${path}"]`);
              await expect(link).toHaveCount(1);
              const badge = link
                .locator("xpath=ancestor::*[@data-slot='sidebar-menu-item'][1]")
                .locator("[data-slot='sidebar-menu-badge']");
              const count = payload.navigation[field];
              if (count > 0) await expect(badge).toHaveText(String(count));
              else await expect(badge).toHaveCount(0);
            }
            expect(bootstrapRequests).toEqual([]);
          } finally {
            await flow.closeContext(context);
          }
        }
      }
    },
  );
});

test("rendering-and-cache.personal-overlays-7", async ({
  shell,
  page,
  context,
}) => {
  await shell.run(
    { sessions: [{ user: 0, deleted: true }, { user: 1 }, { user: 0 }] },
    async ({ users, origin, sessionCookie }) => {
      await context.addCookies([
        await sessionCookie(users[0].id),
        { name: "NEXT_LOCALE", value: "en-us", url: origin },
      ]);
      await gotoAndWaitForReady(page, "/workspace/todos");
      await expect(page.locator("#app-user-menu")).toContainText(users[0].name);
      const localStorageBefore = await page.evaluate(() =>
        JSON.stringify({ ...localStorage }),
      );
      expect(localStorageBefore).not.toContain(users[0].id);
      expect(localStorageBefore).not.toContain(users[0].name);
      await page.locator("#app-user-menu").click();
      await page
        .getByRole("menuitem", { name: "Sign Out", exact: true })
        .click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator("#app-user-menu")).toHaveCount(0);
      const anonymous = await page.request.get("/_internal/shell-bootstrap");
      expect(await anonymous.json()).toEqual({
        viewer: null,
        navigation: null,
        subscribedSections: [],
      });

      await context.addCookies([await sessionCookie(users[1].id)]);
      await gotoAndWaitForReady(page, "/catalog/courses");
      await expect(page.locator("#app-user-menu")).toContainText(users[1].name);
      await expect(page.locator("#app-user-menu")).not.toContainText(
        users[0].name,
      );
      const second = await page.request.get("/_internal/shell-bootstrap");
      expectPrivate(second);
      const secondPayload = await second.json();
      expect(secondPayload.navigation).toMatchObject({
        userId: users[1].id,
        pendingTodosCount: 0,
        subscribedSectionCount: 0,
      });
      expect(JSON.stringify(secondPayload)).not.toContain(users[0].id);
      await gotoAndWaitForReady(page, "/workspace/todos");
      await expect(page.locator("#main-content")).not.toContainText(
        "Shell task",
      );

      // A fresh authenticated navigation must also replace a previous signed-in projection.
      await context.addCookies([await sessionCookie(users[0].id)]);
      await page.reload();
      await expect(page.locator("#app-user-menu")).toContainText(users[0].name);
      await expect(page.locator("#app-user-menu")).not.toContainText(
        users[1].name,
      );
      const first = await page.request.get("/_internal/shell-bootstrap");
      const firstPayload = await first.json();
      expect(firstPayload.navigation).toMatchObject({
        userId: users[0].id,
        pendingTodosCount: 2,
        subscribedSectionCount: 1,
      });
      expect(JSON.stringify(firstPayload)).not.toContain(users[1].id);
      const localStorageAfter = await page.evaluate(() =>
        JSON.stringify({ ...localStorage }),
      );
      for (const user of users) {
        expect(localStorageAfter).not.toContain(user.id);
        expect(localStorageAfter).not.toContain(user.name);
        expect(localStorageAfter).not.toContain(user.email);
      }
    },
  );
});

test("rendering-and-cache.web-rendering-and-cache-1", async ({ shell }) => {
  await shell.run(
    { sessions: [{ user: 0 }, { user: 1 }, { user: 0 }, { user: 1 }] },
    async ({ users, flow, origin, sessionCookie, teacher }) => {
      for (const locale of ["zh-cn", "en-us"]) {
        const anonymous = await flow.newContext();
        const signed = await flow.newContext();
        const otherSigned = await flow.newContext();
        try {
          await anonymous.addCookies([
            { name: "NEXT_LOCALE", value: locale, url: origin },
          ]);
          await signed.addCookies([
            { name: "NEXT_LOCALE", value: locale, url: origin },
            await sessionCookie(users[0].id),
          ]);
          await otherSigned.addCookies([
            { name: "NEXT_LOCALE", value: locale, url: origin },
            await sessionCookie(users[1].id),
          ]);
          for (const path of [
            "/catalog/courses",
            `/catalog/courses/${DEV_SEED.course.jwId}`,
            "/catalog/sections",
            `/catalog/sections/${DEV_SEED.section.jwId}`,
            "/catalog/teachers",
            `/catalog/teachers/${teacher.id}`,
          ]) {
            for (const transport of [
              signed.request,
              anonymous.request,
              otherSigned.request,
            ]) {
              const document = await transport.get(path, {
                headers: { accept: "text/html" },
              });
              expect(document.status(), path).toBe(200);
              const html = await document.text();
              for (const user of users) {
                expect(html, path).not.toContain(user.id);
                expect(html, path).not.toContain(user.name);
                expect(html, path).not.toContain(user.email);
              }
              const dataResponse = await transport.get(`${path}/__data.json`);
              expect(dataResponse.status(), path).toBe(200);
              const body = await dataResponse.json();
              expect(body.type, path).toBe("data");
              const data = Object.assign(
                {},
                ...body.nodes
                  .filter((node: { type: string }) => node?.type === "data")
                  .map((node: { data: unknown[] }) => unflatten(node.data)),
              );
              expect(data.user, path).toBeNull();
              expect(data.resolveViewerOnClient, path).toBe(true);
              expect(data.navStats, path).toBeUndefined();
              if (data.descriptionData)
                expect(data.descriptionData.viewer).toMatchObject({
                  userId: null,
                  isAuthenticated: false,
                });
              if (data.viewer)
                expect(data.viewer).toMatchObject({
                  signedIn: false,
                  isSubscribed: false,
                });
              if (data.homeworkData)
                expect(data.homeworkData.viewer).toMatchObject({
                  userId: null,
                  isAuthenticated: false,
                });
              const serialized = JSON.stringify(data);
              for (const user of users) {
                expect(serialized, path).not.toContain(user.id);
                expect(serialized, path).not.toContain(user.name);
                expect(serialized, path).not.toContain(user.email);
              }
            }
          }
          const page = await signed.newPage();
          await gotoAndWaitForReady(page, "/workspace/todos");
          await expect(page.locator("#app-user-menu")).toContainText(
            users[0].name,
          );
          const catalogData = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
              "/catalog/courses/__data.json",
          );
          await page
            .locator(
              '[data-shell-navigation="desktop"] a[href="/catalog/courses"]',
            )
            .click();
          expect((await catalogData).status()).toBe(200);
          await expect(page).toHaveURL(/\/catalog\/courses$/);
          await expect(page.locator("#app-user-menu")).toContainText(
            users[0].name,
          );
          await page
            .locator(
              `#main-content a[href="/catalog/courses/${DEV_SEED.course.jwId}"]:visible`,
            )
            .first()
            .click();
          await expect(page).toHaveURL(
            new RegExp(`/catalog/courses/${DEV_SEED.course.jwId}$`),
          );
          await expect(page.locator("#app-user-menu")).toContainText(
            users[0].name,
          );
        } finally {
          await flow.closeContext(anonymous);
          await flow.closeContext(signed);
          await flow.closeContext(otherSigned);
        }
      }
    },
  );
});

function normalizePublicHtml(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  for (const element of document.querySelectorAll("[nonce]"))
    element.removeAttribute("nonce");
  const generatedIds = new Map<string, string>();
  for (const element of document.querySelectorAll(
    "[data-scroll-area-viewport] > [data-scroll-area-content][id]",
  )) {
    if (!/^bits-\d+$/.test(element.id)) continue;
    if (generatedIds.has(element.id))
      throw new Error("Duplicate generated accessibility ID");
    generatedIds.set(
      element.id,
      `generated-scroll-content-${generatedIds.size}`,
    );
  }
  const references = [
    "for",
    "form",
    "list",
    "headers",
    "aria-activedescendant",
    "aria-labelledby",
    "aria-describedby",
    "aria-controls",
    "aria-owns",
    "aria-details",
    "aria-errormessage",
    "aria-flowto",
  ];
  for (const element of document.querySelectorAll("*")) {
    const normalizedId = generatedIds.get(element.id);
    if (normalizedId) element.id = normalizedId;
    for (const attribute of references) {
      const value = element.getAttribute(attribute);
      if (value === null) continue;
      element.setAttribute(
        attribute,
        value.replace(/\S+/g, (id) => generatedIds.get(id) ?? id),
      );
    }
    for (const attribute of ["href", "xlink:href"]) {
      const value = element.getAttribute(attribute);
      if (!value?.startsWith("#")) continue;
      const id = generatedIds.get(value.slice(1));
      if (id) element.setAttribute(attribute, `#${id}`);
    }
  }
  return document.documentElement.outerHTML;
}

// Check that the observation adapter cannot hide changed public content or broken references.
browserTest(
  "public HTML normalization preserves text and accessibility relationships",
  async ({ page }) => {
    const markup = (id: string, reference = id, text = "Public content") =>
      `<div data-scroll-area-viewport><div data-scroll-area-content id="${id}">${text}</div></div><button aria-controls="${reference}" aria-label="Open content">Open</button><a href="#${reference}">Jump</a>`;
    const original = await page.evaluate(normalizePublicHtml, markup("bits-1"));
    expect(await page.evaluate(normalizePublicHtml, markup("bits-42"))).toBe(
      original,
    );
    expect(
      await page.evaluate(normalizePublicHtml, markup("bits-42", "bits-99")),
    ).not.toBe(original);
    expect(
      await page.evaluate(
        normalizePublicHtml,
        markup("bits-42", "bits-42", "Different private content"),
      ),
    ).not.toBe(original);
  },
);

test("rendering-and-cache.web-rendering-and-cache-2", async ({
  shell,
  page,
}) => {
  await shell.run(
    { sessions: [{ user: 0 }, { user: 1 }, { user: 0 }, { user: 1 }] },
    async ({ users, flow, origin, sessionCookie, teacher, organizer }) => {
      const paths = [
        "/catalog/courses",
        `/catalog/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
        `/catalog/courses/${DEV_SEED.course.jwId}`,
        "/catalog/sections",
        `/catalog/sections/${DEV_SEED.section.jwId}`,
        "/catalog/teachers",
        `/catalog/teachers/${teacher.id}`,
        "/catalog/links",
        "/catalog/young-events",
        `/catalog/young-events/${DEV_SEED.youngEvent.youngId}`,
        "/catalog/young-events/calendar",
        "/catalog/young-events/organizers",
        `/catalog/young-events/organizers/${organizer.id}`,
      ];
      async function publicHtml(response: APIResponse) {
        expect(response.status(), response.url()).toBe(200);
        // The edge caches anonymous HTML internally, then marks its fresh-nonce browser response private.
        expect(response.headers()["cache-control"], response.url()).toBe(
          "private, no-store",
        );
        const body = await response.text();
        const requestId = response.headers()["x-request-id"];
        for (const user of users) {
          expect(body, response.url()).not.toContain(user.id);
          expect(body, response.url()).not.toContain(user.name);
          expect(body, response.url()).not.toContain(user.email);
        }
        return page.evaluate(
          normalizePublicHtml,
          requestId ? body.replaceAll(requestId, "REQUEST_ID") : body,
        );
      }
      for (const locale of ["zh-cn", "en-us"]) {
        const anonymous = await flow.newContext();
        const signedContexts = await Promise.all(
          users.map(() => flow.newContext()),
        );
        try {
          const localeCookie = {
            name: "NEXT_LOCALE",
            value: locale,
            url: origin,
          };
          await anonymous.addCookies([localeCookie]);
          for (const [index, signed] of signedContexts.entries())
            await signed.addCookies([
              localeCookie,
              await sessionCookie(users[index].id),
            ]);
          for (const path of paths) {
            const expected = await publicHtml(
              await anonymous.request.get(path, {
                headers: { accept: "text/html" },
              }),
            );
            for (const signed of signedContexts) {
              const actual = await publicHtml(
                await signed.request.get(path, {
                  headers: { accept: "text/html" },
                }),
              );
              expect(actual, `${locale}:${path}`).toBe(expected);
            }
          }
          for (const [index, signed] of signedContexts.entries()) {
            const privateProjection = await signed.request.get(
              "/_internal/shell-bootstrap",
            );
            expectPrivate(privateProjection);
            expect((await privateProjection.json()).viewer.id).toBe(
              users[index].id,
            );
          }
        } finally {
          await flow.closeContext(anonymous);
          await Promise.all(
            signedContexts.map((context) => flow.closeContext(context)),
          );
        }
      }
    },
  );
});

test("user.shell-viewer", async ({ shell, page, context }) => {
  await shell.run(
    { debug: true, feedToken: true, sessions: [{ user: 0 }] },
    async ({ users, flow, sessionCookie, teacher, organizer, event }) => {
      await context.addCookies([await sessionCookie(users[0].id)]);
      const identities: string[] = [];
      const identityPaths = new Set([
        "/_internal/shell-bootstrap",
        "/api/account/profile",
        "/api/auth/get-session",
      ]);
      page.on("request", (request) => {
        const path = new URL(request.url()).pathname;
        if (identityPaths.has(path)) identities.push(path);
      });
      const cases = [
        {
          path: `/catalog/courses/${DEV_SEED.course.jwId}`,
          projection: "/api/community/descriptions",
        },
        {
          path: `/catalog/teachers/${teacher.id}`,
          projection: "/api/community/descriptions",
        },
        {
          path: `/catalog/sections/${DEV_SEED.section.jwId}`,
          projection: `/_internal/catalog/sections/${DEV_SEED.section.jwId}/viewer`,
        },
        {
          path: "/catalog/links",
          projection: "/_internal/catalog/links/viewer",
        },
        { path: "/catalog/bus", projection: "/api/workspace/bus-preferences" },
        {
          path: `/catalog/young-events/${event.youngId}`,
          projection: `/api/workspace/young-event-subscriptions/${event.youngId}`,
        },
        {
          path: `/catalog/young-events/organizers/${organizer.id}`,
          projection: `/api/workspace/young-organizer-subscriptions/${organizer.id}`,
        },
        {
          path: "/catalog/young-events/calendar?view=day&date=2035-09-10",
          projection: "/api/workspace/calendar/events",
        },
      ];
      for (const item of cases) {
        identities.length = 0;
        const projection = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === item.projection &&
            response.request().method() === "GET",
        );
        const bootstrap = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/_internal/shell-bootstrap",
        );
        await gotoAndWaitForReady(page, item.path);
        const [personal, shell] = await Promise.all([projection, bootstrap]);
        expect(personal.status(), item.path).toBe(200);
        expect((await shell.json()).viewer.id, item.path).toBe(users[0].id);
        await expect(page.locator("#app-user-menu")).toContainText(
          users[0].name ?? "",
        );
        expect(identities, item.path).toEqual(["/_internal/shell-bootstrap"]);
      }
      identities.length = 0;
      await gotoAndWaitForReady(page, "/workspace/calendar");
      await expect(page.locator("#app-user-menu")).toContainText(
        users[0].name ?? "",
      );
      expect(identities).toEqual([]);
      await gotoAndWaitForReady(page, "/workspace/subscriptions");
      expect(identities).toEqual([]);
      const destination = `/catalog/sections/${DEV_SEED.section.jwId}`;
      // The real subscribed-section link retains the root-layout viewer.
      const projected = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
          `/_internal/catalog/sections/${DEV_SEED.section.jwId}/viewer`,
      );
      await page
        .getByRole("main")
        .locator(`a[href="${destination}"]:visible`)
        .first()
        .click();
      expect((await projected).status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${destination}$`));
      await expect(page.locator("#app-user-menu")).toContainText(
        users[0].name ?? "",
      );
      expect(identities).toEqual([]);
      // Signing in directly to a public detail retains the focused root layout.
      // The completed login must initialize its private shell projection.
      await context.clearCookies();
      await gotoAndWaitForReady(
        page,
        `/account/sign-in?callbackUrl=${encodeURIComponent(destination)}`,
      );
      identities.length = 0;
      const signedInBootstrap = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/_internal/shell-bootstrap",
      );
      const viewerPath = `/_internal/catalog/sections/${DEV_SEED.section.jwId}/viewer`;
      const viewerRequests: Request[] = [];
      const observeViewer = (request: Request) => {
        if (
          request.method() !== "GET" ||
          new URL(request.url()).pathname !== viewerPath
        )
          return;
        viewerRequests.push(request);
        // Login's shell refresh replaces the first section controller.
        if (viewerRequests.length === 1)
          flow.expectReadCancellation(page, request);
      };
      page.on("request", observeViewer);
      try {
        await page
          .getByRole("button", { name: /Debug User \(Dev\)|调试用户（开发）/i })
          .click();
        expect((await (await signedInBootstrap).json()).viewer.name).toBe(
          DEV_SEED.debugName,
        );
        await expect(page).toHaveURL(new RegExp(`${destination}$`));
        await expect(page.locator("#app-user-menu")).toContainText(
          DEV_SEED.debugName,
        );
        expect(identities).toEqual(["/_internal/shell-bootstrap"]);
        await waitForUiSettled(page);
        expect(viewerRequests).toHaveLength(2);
        const successor = await viewerRequests[1].response();
        expect(successor?.status()).toBe(200);
        await successor?.body();
      } finally {
        page.off("request", observeViewer);
      }
    },
  );
});

test("overview.public-html-viewer-independent", async ({ shell, page }) => {
  await shell.run(
    { sessions: [{ user: 0 }, { user: 1 }] },
    async ({ users, flow, sessionCookie }) => {
      const request = page.request;
      for (const user of users) {
        const context = await flow.newContext({
          javaScriptEnabled: false,
        });
        try {
          await context.addCookies([await sessionCookie(user.id)]);
          const response = await context.request.get("/", { maxRedirects: 0 });
          expect(response.status()).toBe(303);
          expect(response.headers().location).toBe("/workspace/overview");
          expect(await response.text()).not.toContain(user.id);
        } finally {
          await flow.closeContext(context);
        }
        for (const locale of ["zh-cn", "en-us"]) {
          const response = await request.get("/", {
            headers: { "Accept-Language": locale },
          });
          expect(response.status()).toBe(200);
          const html = await response.text();
          for (const owner of users) {
            expect(html).not.toContain(owner.id);
            expect(html).not.toContain(owner.email);
            expect(html).not.toContain(owner.name);
          }
          expect(html).not.toContain("Shell task");
          const dataResponse = await request.get("/__data.json", {
            headers: { "Accept-Language": locale },
          });
          expect(dataResponse.status()).toBe(200);
          const envelope = await dataResponse.json();
          const projection = Object.assign(
            {},
            ...envelope.nodes
              .filter((node: { type: string } | null) => node?.type === "data")
              .map((node: { data: unknown[] }) => unflatten(node.data)),
          );
          expect(projection.user).toBeNull();
          expect(projection.navStats).toBeUndefined();
          for (const owner of users)
            expect(JSON.stringify(projection)).not.toContain(owner.id);
          expect(JSON.stringify(projection)).not.toContain("Shell task");
        }
      }
    },
  );
});
