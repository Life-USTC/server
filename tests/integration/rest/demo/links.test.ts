import { type APIResponse, expect } from "@playwright/test";
import { unflatten } from "devalue";
import { catalogLinkListResponseSchema } from "../../../../src/lib/api/schemas/misc-response-schema-core";
import { isRecord } from "../../../../src/lib/is-record";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const pagePath = "/catalog/links";
const viewerPath = "/_internal/catalog/links/viewer";

function privateHeaders(response: APIResponse) {
  expect(response.headers()).toMatchObject({
    "cache-control": "private, no-store",
    "cloudflare-cdn-cache-control": "no-store",
    vary: "Cookie",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
}

function links(body: unknown): Record<string, unknown>[] {
  if (
    !isRecord(body) ||
    !Array.isArray(body.links) ||
    !body.links.every(isRecord)
  )
    throw new Error("Expected a catalog links response");
  return body.links;
}

function fixedFacts(rows: Record<string, unknown>[]) {
  expect(rows).toHaveLength(65);
  expect(new Set(rows.map((row) => row.slug)).size).toBe(65);
  expect(
    rows
      .filter((row) => row.isPinned)
      .map((row) => row.slug)
      .sort(),
  ).toEqual(["jw", "library"]);
  expect(
    Object.fromEntries(
      rows
        .filter((row) => row.clickCount !== 0)
        .map((row) => [String(row.slug), row.clickCount]),
    ),
  ).toEqual({ jw: 12, library: 7, mail: 4, icourse: 2 });
  expect(
    rows.every(
      (row) =>
        typeof row.clickCount === "number" &&
        Number.isSafeInteger(row.clickCount) &&
        row.clickCount >= 0 &&
        typeof row.isPinned === "boolean",
    ),
  ).toBe(true);
}

async function snapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const result: Record<string, unknown[]> = {};
  for (const { tablename } of tables) {
    const name = tablename.replaceAll('"', '""');
    result[tablename] = await db.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM "${name}" t ORDER BY row_to_json(t)::text`,
    );
  }
  return result;
}

for (const locale of ["en-us", "zh-cn"] as const) {
  test(`demo websites seal shared facts, private preferences and effects ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const db = isolatedWorker.database.owner;
      await db.catalogLinkClick.createMany({
        data: [
          { userId: actor.id, slug: "jw", count: 999 },
          { userId: actor.id, slug: "library", count: 998 },
        ],
      });
      await db.workspaceLinkPin.create({
        data: { userId: actor.id, slug: "mail" },
      });
      const ordinaryCookie = `${actor.cookie.name}=${actor.cookie.value}`;
      const ordinary = await request.get(viewerPath, {
        headers: { cookie: `${ordinaryCookie}; NEXT_LOCALE=${locale}` },
      });
      expect(ordinary.status()).toBe(200);
      const ordinaryBody: unknown = await ordinary.json();
      expect(ordinaryBody).toMatchObject({ signedIn: true });
      const ordinaryRows = links(ordinaryBody);
      expect(ordinaryRows.find((row) => row.slug === "jw")).toMatchObject({
        isPinned: false,
        clickCount: 999,
      });
      expect(ordinaryRows.find((row) => row.slug === "library")).toMatchObject({
        isPinned: false,
        clickCount: 998,
      });
      expect(ordinaryRows.find((row) => row.slug === "mail")).toMatchObject({
        isPinned: true,
        clickCount: 0,
      });

      // The ordinary session read finishes before the unchanged-state snapshot.
      const before = await snapshot(isolatedWorker);
      const now = Math.floor(Date.now() / 1000);
      const signed = await createSignedDemoCookie({ issuedAt: now });
      const expired = await createSignedDemoCookie({ issuedAt: now - 901 });
      const cookie = `${signed.name}=${signed.value}; NEXT_LOCALE=${locale}`;
      const secret = { "x-test-storage-secret": "local-test-storage-observer" };
      const id = crypto.randomUUID();
      const probe = `/__test/community-effects?id=${id}`;
      const registration = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      await registration.body();
      expect(registration.status()).toBe(201);
      const observed: { method: string; path: string }[] = [];
      const read = async (
        path: string,
        status = 200,
        method = "GET",
        extra: Record<string, string> = {},
      ) => {
        observed.push({
          method,
          path: new URL(path, isolatedWorker.origin).pathname,
        });
        const response = await request.fetch(path, {
          method,
          maxRedirects: 0,
          headers: {
            ...secret,
            "x-test-community-probe": id,
            cookie,
            origin: isolatedWorker.origin,
            ...extra,
          },
          ...(method === "POST"
            ? { data: { slug: "jw", action: "pin", returnTo: pagePath } }
            : {}),
        });
        await response.body();
        expect(response.status(), `${method} ${path}`).toBe(status);
        privateHeaders(response);
        return response;
      };
      try {
        const html = await (await read(pagePath)).text();
        expect(html).toContain(
          locale === "en-us" ? "Academic Affairs System" : "教务系统",
        );
        expect(html).not.toContain(actor.id);
        const envelope: unknown = await (
          await read(`${pagePath}/__data.json`)
        ).json();
        if (!isRecord(envelope) || !Array.isArray(envelope.nodes))
          throw new Error("Expected Svelte page data");
        const node: unknown = envelope.nodes.at(-1);
        if (!isRecord(node) || !Array.isArray(node.data))
          throw new Error("Expected the links page data node");
        const page: unknown = unflatten(node.data);
        expect(page).toMatchObject({
          locale,
          signedIn: false,
          demo: { referenceNow: "2026-09-24T09:00:00+08:00" },
        });
        if (!isRecord(page)) throw new Error("Expected links page projection");
        expect(page.linksSampleNotice).toMatch(
          locale === "en-us" ? /fictional/i : /虚构/,
        );
        const pageRows = links(page);
        fixedFacts(pageRows);
        expect(pageRows.find((row) => row.slug === "jw")?.title).toBe(
          locale === "en-us" ? "Academic Affairs System" : "教务系统",
        );

        const personal: unknown = await (await read(viewerPath)).json();
        expect(personal).toMatchObject({ signedIn: false });
        expect(links(personal)).toEqual(pageRows);
        const publicBody: unknown = await (
          await read(`/api/catalog/links?locale=${locale}`)
        ).json();
        const publicLinks = catalogLinkListResponseSchema.parse(publicBody);
        expect(publicBody).toEqual(publicLinks);
        expect(publicLinks.links).toHaveLength(65);
        for (const row of links(publicBody)) {
          expect(row).not.toHaveProperty("clickCount");
          expect(row).not.toHaveProperty("isPinned");
        }
        expect(publicLinks.links).toEqual(
          pageRows.map(({ clickCount: _count, isPinned: _pin, ...row }) => row),
        );
        // The public API's existing default is Chinese, independent of cookie.
        const defaultBody = catalogLinkListResponseSchema.parse(
          await (await read("/api/catalog/links")).json(),
        );
        expect(defaultBody.links.find((row) => row.slug === "jw")?.title).toBe(
          "教务系统",
        );
        await read("/api/catalog/links?locale=invalid", 400);

        const home: unknown = await (
          await read("/_internal/home/viewer")
        ).json();
        if (
          !isRecord(home) ||
          !isRecord(home.overview) ||
          !Array.isArray(home.overview.overviewLinks) ||
          !home.overview.overviewLinks.every(isRecord)
        )
          throw new Error("Expected Home website overview");
        expect(home.overview.overviewLinks.map((row) => row.slug)).toEqual([
          "jw",
          "library",
          "mail",
          "icourse",
        ]);
        for (const row of home.overview.overviewLinks)
          expect(row).toEqual(pageRows.find((item) => item.slug === row.slug));

        const targets = [
          pagePath,
          `${pagePath}/__data.json`,
          `/api/catalog/links?locale=${locale}`,
          viewerPath,
          "/_internal/home/viewer",
        ];
        for (const path of targets) {
          expect((await (await read(path, 200, "HEAD")).body()).length).toBe(0);
          await read(path, 401, "GET", {
            cookie: `${expired.name}=${expired.value}`,
          });
          await read(path, 403, "GET", {
            cookie: `${cookie}; ${ordinaryCookie}`,
          });
          await read(path, 403, "POST");
        }
        const signIn = await read(pagePath, 303, "GET", {
          cookie: `${expired.name}=${expired.value}`,
          accept: "text/html",
        });
        expect(signIn.headers().location).toBe("/account/sign-in");
        for (const method of ["GET", "HEAD"]) {
          for (const slug of ["jw", "not-a-demo-website"]) {
            const denied = await read(
              `/api/catalog/links/resolve?slug=${slug}`,
              403,
              method,
            );
            expect(denied.headers().location).toBeUndefined();
          }
        }
        await read("/api/workspace/link-pins", 403, "POST");
        await read("/api/workspace/link-pins/batch", 403, "POST");

        const effectsResponse = await request.get(probe, { headers: secret });
        expect(effectsResponse.status()).toBe(200);
        const effects: unknown = await effectsResponse.json();
        expect(effects).toMatchObject({
          purges: [],
          messages: [],
          backgroundErrors: [],
          io: { bindings: [], outbound: [] },
        });
        if (
          !isRecord(effects) ||
          !Array.isArray(effects.requests) ||
          !effects.requests.every(isRecord)
        )
          throw new Error("Expected completed request observations");
        for (const entry of observed)
          expect(effects.requests).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                outcome: "fulfilled",
                value: expect.objectContaining(entry),
              }),
            ]),
          );
        expect(
          effects.requests.every((entry) => entry.outcome === "fulfilled"),
        ).toBe(true);
        expect(await snapshot(isolatedWorker)).toEqual(before);
      } finally {
        const removed = await request.delete(probe, { headers: secret });
        await removed.body();
        expect(removed.status()).toBe(204);
      }
    });
  });
}
