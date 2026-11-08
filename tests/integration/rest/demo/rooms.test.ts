import { createHash } from "node:crypto";
import { type APIResponse, expect } from "@playwright/test";
import { unflatten } from "devalue";
import { roomMapResponseSchema } from "../../../../src/lib/api/schemas/room-map-schemas";
import { isRecord } from "../../../../src/lib/is-record";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({
  workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" },
  workerOutboundJson: [
    {
      url: "https://static.life-ustc.tiankaima.dev/room_maps.json",
      json: {
        rooms: ["DEMO-101", "REAL-1544"].map((code) => ({
          code,
          building: "Owned ordinary building",
          floor: "1",
          imagePath: "imgs/ordinary-1544.png",
          sourceImagePath: "imgs/ordinary-1544-floor.png",
        })),
      },
    },
    {
      url: "https://static.life-ustc.tiankaima.dev/building_img_rules.json",
      json: [],
    },
  ],
});
const pagePath = "/catalog/rooms";
const mapPath = (code: string) =>
  `/api/catalog/rooms/${encodeURIComponent(code)}/map`;
const assetBase = "/api/catalog/rooms/images/";
const assets = [
  [
    "demo-floor.svg",
    1371,
    "aedc6d46f4423a609b0ef5ba81e17b90f05aa740351e9d3847e5c2ca8733ee77",
  ],
  [
    "demo-room-101.svg",
    1378,
    "12a4b4a734f2aebf1809300fab11dabbf8383e29546fbdd272e780883f621ec9",
  ],
] as const;
function privateHeaders(response: APIResponse) {
  expect(response.headers()).toMatchObject({
    "cache-control": "private, no-store",
    "cloudflare-cdn-cache-control": "no-store",
    vary: "Cookie",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
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
  test(`demo rooms seal diagrams, lookup states and effects ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const ordinaryCookie = `${actor.cookie.name}=${actor.cookie.value}`;
      // Exercise the original service and owned upstream manifest before the probe.
      for (const code of ["DEMO-101", "REAL-1544"]) {
        const ordinary = await request.get(mapPath(code), {
          headers: { cookie: ordinaryCookie },
        });
        expect(ordinary.status()).toBe(200);
        expect(roomMapResponseSchema.parse(await ordinary.json())).toEqual({
          code,
          building: "Owned ordinary building",
          floor: "1",
          status: "highlighted",
          imageUrl:
            "https://static.life-ustc.tiankaima.dev/imgs/ordinary-1544.png",
          sourceImageUrl:
            "https://static.life-ustc.tiankaima.dev/imgs/ordinary-1544-floor.png",
        });
      }
      for (const code of ["images", "IMAGES"]) {
        const ordinary = await request.get(mapPath(code), {
          headers: { cookie: ordinaryCookie },
        });
        expect(ordinary.status()).toBe(200);
        expect(await ordinary.json()).toEqual({
          code: "IMAGES",
          building: null,
          floor: null,
          status: "unavailable",
          imageUrl: null,
          sourceImageUrl: null,
        });
      }
      for (const [name] of assets) {
        const ordinaryAsset = await request.get(`${assetBase}${name}`, {
          headers: { cookie: ordinaryCookie },
        });
        await ordinaryAsset.body();
        expect(ordinaryAsset.status()).toBe(404);
      }
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
          ...(method === "POST" ? { data: { code: "DEMO-101" } } : {}),
        });
        await response.body();
        expect(response.status(), `${method} ${path}`).toBe(status);
        privateHeaders(response);
        return response;
      };
      try {
        const html = await (await read(pagePath)).text();
        expect(html).toContain(
          locale === "en-us" ? "Fictional teaching building" : "虚构教学楼",
        );
        expect(html).not.toContain("Owned ordinary building");
        expect(html).not.toContain(actor.id);
        const envelope: unknown = await (
          await read(`${pagePath}/__data.json?room=DEMO-101`)
        ).json();
        if (!isRecord(envelope) || !Array.isArray(envelope.nodes))
          throw new Error("Expected room page nodes");
        const node: unknown = envelope.nodes.at(-1);
        if (!isRecord(node) || !Array.isArray(node.data))
          throw new Error("Expected room page data");
        const page: unknown = unflatten(node.data);
        if (!isRecord(page) || !isRecord(page.copy))
          throw new Error("Expected room page projection");
        expect(page).toMatchObject({
          initialRoom: "DEMO-101",
          demo: { referenceNow: "2026-09-24T09:00:00+08:00" },
        });
        const building =
          locale === "en-us" ? "Fictional teaching building" : "虚构教学楼";
        expect(page.buildings).toEqual([
          {
            building,
            campus:
              locale === "en-us" ? "Fictional sample campus" : "虚构样例校区",
            floors: [{ floor: "1", codes: ["DEMO-101"] }],
            roomCount: 1,
          },
        ]);
        expect(page.copy.sampleRooms).toEqual([
          "DEMO-101",
          "DEMO-1",
          "DEMO-NONE",
        ]);
        expect(page.copy.subtitle).toMatch(
          locale === "en-us" ? /Fictional.*not.*actual/ : /虚构.*不代表.*真实/,
        );
        const expected = [
          {
            code: "DEMO-101",
            building,
            floor: "1",
            status: "highlighted",
            imageUrl: `${assetBase}demo-room-101.svg`,
            sourceImageUrl: `${assetBase}demo-floor.svg`,
          },
          {
            code: "DEMO-1",
            building: null,
            floor: null,
            status: "overview",
            imageUrl: `${assetBase}demo-floor.svg`,
            sourceImageUrl: `${assetBase}demo-floor.svg`,
          },
          {
            code: "DEMO-NONE",
            building: null,
            floor: null,
            status: "unavailable",
            imageUrl: null,
            sourceImageUrl: null,
          },
        ];
        for (const map of expected) {
          const raw: unknown = await (await read(mapPath(map.code))).json();
          expect(roomMapResponseSchema.parse(raw)).toEqual(map);
          expect(raw).toEqual(map);
        }
        expect(
          await (await read(mapPath("  ｄｅｍｏ-１０１  "))).json(),
        ).toEqual(expected[0]);
        await read(mapPath("REAL-1544"), 404);
        await read(mapPath("DEMO-UNKNOWN"), 404);
        await read(mapPath("images"), 404);
        // Raw length is bounded before NFKC; these valid expanded codes are foreign.
        for (const code of ["Ⅷ".repeat(17), "ﬄ".repeat(22)])
          await read(mapPath(code), 404);
        for (const code of ["invalid code", "A".repeat(65)])
          await read(mapPath(code), 400);
        for (const [name, length, sha] of assets) {
          const path = `${assetBase}${name}`;
          const response = await read(path);
          const bytes = await response.body();
          expect(bytes.length).toBe(length);
          expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha);
          expect(bytes.toString()).toContain("DEMO · FICTIONAL SCHEMATIC");
          const headers = response.headers();
          expect(headers["content-type"]).toMatch(/^image\/svg\+xml(?:;|$)/);
          expect(headers["x-content-type-options"]).toBe("nosniff");
          expect(headers["content-security-policy"]).toBe(
            "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          );
          expect(headers.etag).toBe(`"${sha}"`);
          // The Worker lifecycle wraps bodies in a stream; framing may omit length.
          if (headers["content-length"] !== undefined)
            expect(headers["content-length"]).toBe(String(bytes.length));
          const head = await read(path, 200, "HEAD");
          expect((await head.body()).length).toBe(0);
          expect(head.headers().etag).toBe(`"${sha}"`);
          for (const etag of [`W/"${sha}"`, "*", `"different", W/"${sha}"`]) {
            const cached = await read(path, 304, "GET", {
              "if-none-match": etag,
            });
            expect((await cached.body()).length).toBe(0);
            expect(cached.headers().etag).toBe(`"${sha}"`);
          }
        }
        await read(`${assetBase}unknown.svg`, 404);
        await read(`${assetBase}${"x".repeat(61)}.svg`, 400);
        await read(`${assetBase}demo-floor.svg?unknown=1`, 400);
        const targets = [
          pagePath,
          `${pagePath}/__data.json`,
          mapPath("DEMO-101"),
          `${assetBase}demo-floor.svg`,
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
        const expiredHtml = await read(pagePath, 303, "GET", {
          cookie: `${expired.name}=${expired.value}`,
          accept: "text/html",
        });
        expect(expiredHtml.headers().location).toBe("/account/sign-in");
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
          throw new Error("Expected request observations");
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
