import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";

// Canonical by-id resolution must not reinterpret the existing immutable URI.
test("canonical Young poster resolution preserves legacy inline image resources", {
  tag: "@Young/REST",
}, async ({ request, isolatedWorker, run }) => {
  await run(async () => {
    const poster = await readFile("public/images/icon.png");
    const inline = await readFile("public/images/ustc_favicon.png");
    expect(inline.equals(poster)).toBe(false);
    const posterPath = "group1/contract/poster.jpg";
    const imageBase = "/api/catalog/young-events/images/";
    const ordinaryId = `owned-image-1551-${crypto.randomUUID()}`;
    const db = isolatedWorker.database.owner;
    expect(
      await db.youngEvent.findUnique({ where: { youngId: "images" } }),
    ).toBeNull();
    expect(
      await db.youngEvent.findUnique({ where: { youngId: "by-id" } }),
    ).toBeNull();
    await db.youngEvent.createMany({
      data: ["images", "by-id", ordinaryId].map((youngId) => ({
        youngId,
        name: `Owned poster collision ${youngId}`,
        isActive: true,
        rawJson: { fixture: "owned image route collision" },
        imageUrl: posterPath,
      })),
    });
    const secret = { "x-test-storage-secret": "local-test-storage-observer" };
    const storage = (key: string) =>
      `/__test/storage/publications?key=${encodeURIComponent(key)}`;
    const inlineKey = "young-events/images/image";
    expect(
      (await request.put(storage(inlineKey), { data: inline })).status(),
    ).toBe(404);
    expect(
      (
        await request.put(storage(`${inlineKey}-unapproved`), {
          headers: secret,
          data: inline,
        })
      ).status(),
    ).toBe(400);
    for (const [path, bytes] of [
      [posterPath, poster],
      ["image", inline],
    ] as const) {
      const stored = await request.put(storage(`young-events/images/${path}`), {
        headers: { ...secret, "content-type": "image/png" },
        data: bytes,
      });
      await stored.body();
      expect(stored.status()).toBe(204);
      const positive = await request.get(
        storage(`young-events/images/${path}`),
        { headers: secret },
      );
      expect(positive.status()).toBe(200);
      expect(await positive.body()).toEqual(bytes);
    }
    const probeId = crypto.randomUUID();
    const probe = `/__test/community-effects?id=${probeId}`;
    const registered = await request.post(`${probe}&io=1`, { headers: secret });
    await registered.body();
    expect(registered.status()).toBe(201);
    const headers = { ...secret, "x-test-community-probe": probeId };
    const errors: unknown[] = [];
    try {
      for (const id of ["images", "by-id", ordinaryId]) {
        for (const method of ["GET", "HEAD"]) {
          const canonical = await request.fetch(
            `/api/catalog/young-events/by-id/${id}/image`,
            {
              method,
              headers,
              maxRedirects: 0,
            },
          );
          expect(canonical.status()).toBe(302);
          expect(canonical.headers()).toMatchObject({
            location: `${imageBase}${posterPath}`,
            "cache-control": "no-store",
            "cloudflare-cdn-cache-control": "no-store",
          });
          expect(await canonical.body()).toHaveLength(0);
        }
      }
      for (const id of [ordinaryId, "by-id"]) {
        const ordinary = await request.get(
          `/api/catalog/young-events/${id}/image`,
          { headers, maxRedirects: 0 },
        );
        await ordinary.body();
        expect(ordinary.status()).toBe(302);
        expect(ordinary.headers()).toMatchObject({
          location: `${imageBase}${posterPath}`,
          "cache-control": "no-store",
        });
      }
      const immutable = await request.get(`${imageBase}${posterPath}`, {
        headers,
        maxRedirects: 0,
      });
      expect(immutable.status()).toBe(200);
      expect(await immutable.body()).toEqual(poster);
      expect(immutable.headers()["cache-control"]).toBe(
        "public, max-age=31536000, immutable, no-transform",
      );
      const posterEtag = immutable.headers().etag;
      expect(posterEtag).toBeTruthy();
      const unchanged = await request.get(`${imageBase}${posterPath}`, {
        headers: { ...headers, "if-none-match": posterEtag },
        maxRedirects: 0,
      });
      expect(unchanged.status()).toBe(304);
      expect(await unchanged.body()).toHaveLength(0);
      const collision = await request.get(`${imageBase}image`, {
        headers,
        maxRedirects: 0,
      });
      expect(collision.status()).toBe(200);
      expect(await collision.body()).toEqual(inline);
      expect(collision.headers().location).toBeUndefined();
      expect(collision.headers()["cache-control"]).toBe(
        "public, max-age=31536000, immutable, no-transform",
      );
      // The signed-in state is irrelevant: these are ordinary public requests.
      // Successful R2 bodies and the real outbound probe prove no origin fetch.
      const effects = await request.get(probe, { headers: secret });
      expect(effects.status()).toBe(200);
      expect(await effects.json()).toMatchObject({
        io: { outbound: [] },
        backgroundErrors: [],
      });
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        const removed = await request.delete(probe, { headers: secret });
        await removed.body();
        expect(removed.status()).toBe(204);
      } catch (error) {
        errors.push(error);
      }
    }
    // The owned Worker fixture retires the entire DB and R2 namespace after run joins.
    if (errors.length)
      throw new AggregateError(errors, "Owned Young route diagnostic failed");
  });
});
