import { expect, type Page, test } from "@playwright/test";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../../../../shared/catalog-contract-fixture";
import { createCalendarContractFixture } from "../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { waitForUiSettled } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";
import {
  INVENTORY_SETTINGS_TABS,
  INVENTORY_WORKSPACE_TABS,
  PAGE_INVENTORY,
} from "../_shared/page-inventory";

const selectors = {
  canonical: 'link[rel="canonical"]',
  description: 'meta[name="description"]',
  ogTitle: 'meta[property="og:title"]',
  ogDescription: 'meta[property="og:description"]',
  ogType: 'meta[property="og:type"]',
  ogUrl: 'meta[property="og:url"]',
  ogSiteName: 'meta[property="og:site_name"]',
  ogLocale: 'meta[property="og:locale"]',
  ogLocaleAlternate: 'meta[property="og:locale:alternate"]',
  ogImage: 'meta[property="og:image"]',
  ogImageType: 'meta[property="og:image:type"]',
  ogImageWidth: 'meta[property="og:image:width"]',
  ogImageHeight: 'meta[property="og:image:height"]',
  ogImageAlt: 'meta[property="og:image:alt"]',
  twitterCard: 'meta[name="twitter:card"]',
  twitterTitle: 'meta[name="twitter:title"]',
  twitterDescription: 'meta[name="twitter:description"]',
  twitterImage: 'meta[name="twitter:image"]',
  twitterImageAlt: 'meta[name="twitter:image:alt"]',
};
async function metadata(page: Page, html: string | null) {
  return page.evaluate(
    ({ html, selectors }) => {
      const doc =
        html === null
          ? document
          : new DOMParser().parseFromString(html, "text/html");
      return {
        lang: doc.documentElement.lang,
        values: Object.fromEntries(
          Object.entries(selectors).map(([key, selector]) => [
            key,
            Array.from(doc.head.querySelectorAll(selector)).map(
              (node) =>
                node.getAttribute("content") ?? node.getAttribute("href") ?? "",
            ),
          ]),
        ),
      };
    },
    { html, selectors },
  );
}

test("ui.social-sharing-metadata-1", async ({ page }) => {
  test.setTimeout(180_000);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  const catalog = await withE2ePrisma(createCatalogContractFixture);
  const calendar = await createCalendarContractFixture();
  const marker = crypto.randomUUID();
  const secrets = [
    `private-title-${marker}`,
    `private-body-${marker}`,
    `feed-token-${marker}`,
    `client-secret-${marker}`,
    `authorization-code-${marker}`,
    `oauth-state-${marker}`,
  ];
  const extra = await withE2ePrisma(async (db) => {
    await db.user.update({
      where: { id: calendar.users[0].id },
      data: { isAdmin: true, calendarFeedToken: secrets[2] },
    });
    await db.todo.update({
      where: { id: calendar.todo.id },
      data: { title: secrets[0], content: secrets[1] },
    });
    const welcome = await db.user.create({
      data: { email: `welcome-${marker}@example.test` },
    });
    const organizer = await db.youngOrganizer.create({
      data: {
        name: `Metadata organizer ${marker}`,
        normalizedName: `metadata-organizer-${marker}`,
      },
    });
    const source = await db.publicationSource.create({
      data: { id: `metadata-${marker}`, name: "Metadata source" },
    });
    const publication = await db.publication.create({
      data: {
        sourceId: source.id,
        canonicalUrl: `https://example.test/${marker}`,
        title: "Metadata news",
        publicationType: "news",
      },
    });
    const revision = await db.publicationRevision.create({
      data: {
        publicationId: publication.id,
        revisionHash: marker,
        observedAt: new Date(),
        title: "Metadata news",
        publicationType: "news",
      },
    });
    await db.publication.update({
      where: { id: publication.id },
      data: { currentRevisionId: revision.id },
    });
    const client = await db.oAuthClient.create({
      data: {
        clientId: `metadata-${marker}`,
        clientSecret: secrets[3],
        userId: calendar.users[0].id,
        name: `Private client ${marker}`,
        redirectUris: [`${PLAYWRIGHT_BASE_URL}/e2e/oauth/callback`],
        scopes: ["openid", "profile"],
      },
    });
    return { welcome, organizer, source, publication, client };
  });
  try {
    const dynamic: Record<string, string> = {
      "/catalog/courses/[jwId]": `/catalog/courses/${catalog.courses[0].jwId}`,
      "/catalog/sections/[jwId]": `/catalog/sections/${catalog.sections[0].jwId}`,
      "/catalog/teachers/[id]": `/catalog/teachers/${catalog.teachers[0].id}`,
      "/catalog/young-events/[youngId]": `/catalog/young-events/${calendar.young.youngId}`,
      "/catalog/young-events/organizers/[organizerId]": `/catalog/young-events/organizers/${extra.organizer.id}`,
      "/community/users/[identifier]": `/community/users/${calendar.users[0].username}`,
      "/news/[id]": `/news/${extra.publication.id}`,
    };
    const cases = PAGE_INVENTORY.filter(
      (entry) => entry.kind === "page",
    ).flatMap((entry) => {
      const paths =
        entry.routeId === "/account/settings/[tab]"
          ? INVENTORY_SETTINGS_TABS.map((tab) => `/account/settings/${tab}`)
          : entry.routeId === "/workspace/[tab]"
            ? INVENTORY_WORKSPACE_TABS.map((tab) => `/workspace/${tab}`)
            : [dynamic[entry.routeId] ?? entry.samplePath];
      return paths.map((path) => ({
        route: entry.routeId,
        path,
        auth: entry.auth,
      }));
    });
    expect(cases.some(({ path }) => path.includes("["))).toBe(false);
    const localizedDescriptions = new Map<string, string[]>();
    for (const locale of ["zh-cn", "en-us"] as const) {
      for (const entry of new Map(
        cases.map((entry) => [entry.path, entry]),
      ).values()) {
        await test.step(`${locale} ${entry.path}`, async () => {
          const privatePage =
            entry.auth !== "public" || entry.path.startsWith("/oauth/");
          const userId =
            entry.path === "/account/welcome"
              ? extra.welcome.id
              : calendar.users[0].id;
          await page.context().clearCookies();
          await page
            .context()
            .addCookies([
              { name: "NEXT_LOCALE", value: locale, url: PLAYWRIGHT_BASE_URL },
              ...(privatePage ? [await createSignedSessionCookie(userId)] : []),
            ]);
          const url = new URL(entry.path, PLAYWRIGHT_BASE_URL);
          url.searchParams.set("code", secrets[4]);
          url.searchParams.set("state", secrets[5]);
          url.searchParams.set(
            "callbackUrl",
            `/workspace/todos?token=${secrets[2]}`,
          );
          if (entry.path === "/oauth/authorize") {
            url.searchParams.set("client_id", extra.client.clientId);
            url.searchParams.set("scope", "openid profile");
            url.searchParams.set(
              "redirect_uri",
              `${PLAYWRIGHT_BASE_URL}/e2e/oauth/callback`,
            );
          }
          const response = await page.goto(`${url.pathname}${url.search}`);
          if (!response)
            throw new Error(`No document response for ${entry.path}`);
          expect(response.status(), entry.path).toBe(200);
          expect(new URL(page.url()).pathname).toBe(
            new URL(entry.path, PLAYWRIGHT_BASE_URL).pathname,
          );
          const raw = await metadata(page, await response.text());
          await waitForUiSettled(page);
          const hydrated = await metadata(page, null);
          expect(browserErrors, entry.path).toEqual([]);
          expect(hydrated).toEqual(raw);
          expect(raw.lang).toBe(locale);
          for (const [key, values] of Object.entries(raw.values)) {
            expect(values, `${entry.path}: ${key}`).toHaveLength(1);
            expect(values[0].trim(), `${entry.path}: ${key}`).not.toBe("");
          }
          const values = Object.fromEntries(
            Object.entries(raw.values).map(([key, value]) => [key, value[0]]),
          );
          expect(values.ogDescription).toBe(values.description);
          expect(values.twitterDescription).toBe(values.description);
          expect(values.twitterTitle).toBe(values.ogTitle);
          expect(values.twitterImage).toBe(values.ogImage);
          expect(values.twitterImageAlt).toBe(values.ogImageAlt);
          expect(values.ogLocale).toBe(locale === "zh-cn" ? "zh_CN" : "en_US");
          expect(values.ogLocaleAlternate).toBe(
            locale === "zh-cn" ? "en_US" : "zh_CN",
          );
          expect(values.canonical).toBe(
            `${new URL(PLAYWRIGHT_BASE_URL).origin}${url.pathname}`,
          );
          expect(values.ogUrl).toBe(values.canonical);
          expect(values.ogType).toBe("website");
          expect(values.ogSiteName).toBe("Life@USTC");
          expect(values.twitterCard).toBe("summary_large_image");
          expect(values.ogImage).toBe(
            `${new URL(PLAYWRIGHT_BASE_URL).origin}/open-graph.png`,
          );
          expect([
            values.ogImageWidth,
            values.ogImageHeight,
            values.ogImageType,
          ]).toEqual(["1200", "630", "image/png"]);
          const allValues = JSON.stringify(values);
          for (const secret of secrets) expect(allValues).not.toContain(secret);
          if (privatePage || entry.path.startsWith("/account/")) {
            expect(values.description).toBe(
              locale === "zh-cn"
                ? "中国科学技术大学课程与日程管理系统"
                : "USTC course and schedule management system",
            );
            for (const privateValue of [
              calendar.users[0].name,
              calendar.users[0].email,
              extra.client.name,
            ])
              if (privateValue) expect(allValues).not.toContain(privateValue);
          }
          localizedDescriptions.set(entry.path, [
            ...(localizedDescriptions.get(entry.path) ?? []),
            values.description,
          ]);
        });
      }
    }
    for (const [path, descriptions] of localizedDescriptions) {
      expect(descriptions, path).toHaveLength(2);
      expect(descriptions[0], path).not.toBe(descriptions[1]);
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.oAuthClient.delete({ where: { id: extra.client.id } });
      await db.user.delete({ where: { id: extra.welcome.id } });
      await db.youngOrganizer.delete({ where: { id: extra.organizer.id } });
      await db.publicationSource.delete({ where: { id: extra.source.id } });
      await cleanupCatalogContractFixture(db, catalog);
    });
    await calendar.cleanup();
  }
});
