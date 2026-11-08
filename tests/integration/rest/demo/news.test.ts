import { createHash } from "node:crypto";
import { type APIResponse, expect } from "@playwright/test";
import { unflatten } from "devalue";
import type {
  PublicPublicationDetail,
  PublicPublicationList,
} from "../../../../src/features/publications/server/publication-public-read-service";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const pages = ["/news", "/news/demo-news-1", "/news/sources"];
const apis = [
  "/api/publications",
  "/api/publications/demo-news-1",
  "/api/publications/sources",
];
const hash = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
function privateHeaders(response: APIResponse) {
  expect(response.headers()).toMatchObject({
    "cache-control": "private, no-store",
    "cloudflare-cdn-cache-control": "no-store",
    vary: "Cookie",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
}

for (const locale of ["en-us", "zh-cn"] as const) {
  test(`demo news seals pages, queries, revision bytes and effects ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const db = isolatedWorker.database.owner;
      const foreignSource = await db.publicationSource.create({
        data: {
          id: `private-${crypto.randomUUID()}`,
          name: "Real source outside the demo graph",
        },
      });
      const foreign = await db.publication.create({
        data: {
          sourceId: foreignSource.id,
          canonicalUrl: "https://example.invalid/private-news",
          title: "Real database article must stay outside demo",
          publicationType: "news",
        },
      });
      const foreignRevision = await db.publicationRevision.create({
        data: {
          publicationId: foreign.id,
          revisionHash: hash(foreign.title),
          observedAt: new Date("2026-09-24T09:00:00+08:00"),
          title: foreign.title,
          bodyText: "Ordinary public article; no R2 objects required.",
          publicationType: "news",
        },
      });
      await db.publication.update({
        where: { id: foreign.id },
        data: { currentRevisionId: foreignRevision.id },
      });
      // Establish a positive ordinary reader before measuring Demo isolation.
      const ordinary = await request.get(`/api/publications/${foreign.id}`);
      expect(ordinary.status()).toBe(200);
      expect(await ordinary.json()).toMatchObject({
        id: foreign.id,
        revision: { title: foreign.title },
      });
      const snapshot = async () => ({
        users: await db.user.findMany({ orderBy: { id: "asc" } }),
        sessions: await db.session.findMany({
          orderBy: { sessionToken: "asc" },
        }),
        sources: await db.publicationSource.findMany({
          orderBy: { id: "asc" },
        }),
        publications: await db.publication.findMany({ orderBy: { id: "asc" } }),
        revisions: await db.publicationRevision.findMany({
          orderBy: { id: "asc" },
        }),
        objects: await db.publicationObject.findMany({
          orderBy: { id: "asc" },
        }),
      });
      const before = await snapshot();
      const signed = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
      });
      const expired = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000) - 901,
      });
      const secret = { "x-test-storage-secret": "local-test-storage-observer" };
      const probeId = crypto.randomUUID();
      const probe = `/__test/community-effects?id=${probeId}`;
      const headers = {
        ...secret,
        "x-test-community-probe": probeId,
        cookie: `${signed.name}=${signed.value}; NEXT_LOCALE=${locale}`,
        origin: isolatedWorker.origin,
      };
      const registration = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      await registration.body();
      expect(registration.status()).toBe(201);
      try {
        const read = async (path: string) => {
          const response = await request.get(path, { headers });
          expect(response.status(), path).toBe(200);
          privateHeaders(response);
          return response;
        };
        for (const path of pages) {
          const html = await read(path);
          const text = await html.text();
          expect(text).not.toContain(foreign.title);
          expect(text).not.toContain(actor.id);
          const data = await read(`${path}/__data.json`);
          const envelope = await data.json();
          const page = unflatten(envelope.nodes.at(-1).data) as {
            demo: { referenceNow: string };
          };
          expect(page.demo.referenceNow).toBe("2026-09-24T09:00:00+08:00");
        }
        const list = (await (
          await read(apis[0])
        ).json()) as PublicPublicationList;
        expect(list.pagination).toEqual({
          page: 1,
          pageSize: 20,
          total: 22,
          totalPages: 2,
        });
        expect(list.data).toHaveLength(20);
        expect(list.data[0]).toMatchObject({
          id: "demo-news-1",
          revision: {
            title:
              locale === "en-us"
                ? "Sample reading room hours"
                : "虚构阅览室开放时间",
          },
        });
        expect(JSON.stringify(list)).not.toContain(foreign.id);
        const home = await (await read("/_internal/home/notices")).json();
        expect(
          home.notices.map((notice: { href: string; title: string }) => ({
            href: notice.href,
            title: notice.title,
          })),
        ).toEqual(
          list.data.slice(0, 5).map((row) => ({
            href: `/news/${row.id}`,
            title: row.revision.title,
          })),
        );
        const second = (await (
          await read("/api/publications?page=2")
        ).json()) as PublicPublicationList;
        expect(second.data.map((row) => row.id)).toEqual([
          "demo-news-21",
          "demo-news-22",
        ]);
        const folded = (await (
          await read("/api/publications?page=2&fold=1")
        ).json()) as PublicPublicationList;
        expect(folded.pagination.total).toBe(21);
        expect(folded.data).toMatchObject([
          { id: "demo-news-21", foldGroup: { siblingCount: 1 } },
        ]);
        for (const [query, total] of [
          ["source=demo-study&source=demo-society,demo-study", 15],
          ["organizationLevel=student&organizationLevel=society", 15],
          ["source=demo-study&organizationLevel=center", 0],
          ["type=news&type=notice", 10],
          ["source=demo-empty", 0],
          [
            `query=${encodeURIComponent(locale === "en-us" ? "reading room" : "阅览室")}`,
            1,
          ],
          [
            `query=${encodeURIComponent(locale === "en-us" ? "Notebooks" : "笔记本")}`,
            0,
          ],
        ] as const) {
          const body = (await (
            await read(`/api/publications?${query}`)
          ).json()) as PublicPublicationList;
          expect(body.pagination.total, query).toBe(total);
          if (total === 0) expect(body.pagination.totalPages).toBe(1);
        }
        const cleared = await read(
          "/news/__data.json?type=&query=&fold=&source=&organizationLevel=",
        );
        const clearedEnvelope = await cleared.json();
        const clearedPage = unflatten(clearedEnvelope.nodes.at(-1).data) as {
          publications: PublicPublicationList;
        };
        expect(clearedPage.publications.pagination.total).toBe(22);
        const redirect = await request.get("/news?page=3&source=demo-empty", {
          headers,
          maxRedirects: 0,
        });
        expect(redirect.status()).toBe(307);
        expect(redirect.headers().location).toBe(
          "/news?page=1&source=demo-empty",
        );
        await redirect.body();
        privateHeaders(redirect);
        const directory = await (await read(apis[2])).json();
        expect(directory.totals).toEqual({
          sourceCount: 4,
          publicationCount: 22,
        });
        expect(JSON.stringify(directory)).not.toContain(foreignSource.id);
        const detail = (await (
          await read(apis[1])
        ).json()) as PublicPublicationDetail;
        expect(detail.renderedBodyHtml).toContain("<table");
        expect(detail.revision.objects).toHaveLength(3);
        const binaryPaths: string[] = [];
        for (const object of detail.revision.objects) {
          const path = `/api/publications/objects/${object.kind}/${object.sha256}`;
          binaryPaths.push(path);
          const response = await read(path);
          const bytes = await response.body();
          expect(hash(bytes)).toBe(object.sha256);
          expect(bytes.length).toBe(object.size);
          expect(response.headers().etag).toBe(`"${object.sha256}"`);
          expect(response.headers()["x-content-type-options"]).toBe("nosniff");
          expect(response.headers()["content-disposition"]).toMatch(
            object.kind === "media" ? /^inline$/ : /^attachment;/,
          );
          if (object.kind === "body_markdown")
            expect(bytes.toString("utf8")).toBe(detail.revision.bodyMarkdown);
          if (object.kind === "asset")
            expect(bytes.toString("utf8")).toContain("不是学校通知");
          const conditional = await request.get(path, {
            headers: { ...headers, "if-none-match": `W/"${object.sha256}"` },
          });
          expect(conditional.status()).toBe(304);
          privateHeaders(conditional);
          expect((await conditional.body()).length).toBe(0);
        }
        const imageId = hash(
          "https://demo.invalid/images/fictional-demo-chart.png",
        );
        expect(detail.revision.images[0].id).toBe(imageId);
        const imagePath = `/api/publications/images/${imageId}`;
        binaryPaths.push(imagePath);
        const image = await read(imagePath);
        const imageBytes = await image.body();
        expect([...imageBytes.subarray(0, 8)]).toEqual([
          137, 80, 78, 71, 13, 10, 26, 10,
        ]);
        const imageHash = hash(imageBytes);
        const cachedImage = await request.get(imagePath, {
          headers: { ...headers, "if-none-match": `W/"${imageHash}"` },
        });
        expect(cachedImage.status()).toBe(304);
        privateHeaders(cachedImage);
        expect((await cachedImage.body()).length).toBe(0);
        expect(
          detail.revision.objects.find((object) => object.kind === "media")
            ?.sha256,
        ).toBe(imageHash);
        const reprint = (await (
          await read("/api/publications/demo-news-21")
        ).json()) as PublicPublicationDetail;
        expect(reprint.alsoPublishedIn.map((row) => row.id)).toEqual([
          "demo-news-22",
        ]);
        for (const [path, status] of [
          [`/api/publications/${foreign.id}`, 404],
          [`/api/publications?source=${foreignSource.id}`, 404],
          ["/api/publications?page=0", 400],
          ["/api/publications?query=", 400],
          ["/api/publications?unexpected=1", 400],
          ["/api/publications/sources?query=real", 400],
          ["/api/publications/demo-news-1?source=demo-study", 400],
          [`/api/publications/images/${imageHash}`, 404],
          [`/api/publications/objects/media/${imageId}`, 404],
          [`/api/publications/objects/raw_page/${imageHash}`, 404],
          [`/api/publications/objects/asset/${"0".repeat(64)}`, 404],
          ["/api/admin/publications", 403],
        ] as const) {
          const response = await request.get(path, {
            headers,
            maxRedirects: 0,
          });
          expect(response.status(), path).toBe(status);
          privateHeaders(response);
          await response.body();
        }
        const targets = [
          ...pages,
          ...pages.map((path) => `${path}/__data.json`),
          ...apis,
          ...binaryPaths,
        ];
        for (const path of targets) {
          const head = await request.head(path, { headers });
          expect(head.status(), path).toBe(200);
          privateHeaders(head);
          expect((await head.body()).length).toBe(0);
          for (const [cookie, status] of [
            [`${expired.name}=${expired.value}`, 401],
            [
              `${signed.name}=${signed.value}; ${actor.cookie.name}=${actor.cookie.value}`,
              403,
            ],
          ] as const) {
            const response = await request.get(path, {
              headers: { ...headers, cookie },
              maxRedirects: 0,
            });
            expect(response.status(), path).toBe(status);
            privateHeaders(response);
            await response.body();
          }
          const write = await request.post(path, { headers, data: {} });
          expect(write.status(), path).toBe(403);
          privateHeaders(write);
          await write.body();
        }
        const effectsResponse = await request.get(probe, { headers: secret });
        expect(effectsResponse.status()).toBe(200);
        const effects = await effectsResponse.json();
        expect(effects).toMatchObject({
          purges: [],
          messages: [],
          backgroundErrors: [],
          io: { bindings: [], outbound: [] },
        });
        for (const path of targets)
          for (const method of ["GET", "HEAD"])
            expect(effects.requests).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  outcome: "fulfilled",
                  value: expect.objectContaining({
                    method,
                    path: new URL(path, isolatedWorker.origin).pathname,
                  }),
                }),
              ]),
            );
        expect(
          effects.requests.every(
            (entry: { outcome: string }) => entry.outcome === "fulfilled",
          ),
        ).toBe(true);
        expect(await snapshot()).toEqual(before);
      } finally {
        const removed = await request.delete(probe, { headers: secret });
        await removed.body();
        expect(removed.status()).toBe(204);
      }
    });
  });
}
