import { expect, vi } from "vitest";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import { getCanonicalOrigin } from "@/lib/site-url";
import { GET as getSitemap } from "@/routes/sitemap.xml/+server";
import { publicDiscoveryTest as it } from "../shared/public-discovery-fixture";

// Keep its global clock and memory/colo cache separate from the search case.
it("rendering-and-cache.sitemap-freshness", async ({ discovery: h }) => {
  const youngId = `${h.catalog.marker}-sitemap`;
  const origin = getCanonicalOrigin();
  const urls = (body: string) =>
    Array.from(body.matchAll(/<loc>(.+)<\/loc>/g), (match) => match[1]);
  const read = (etag?: string) =>
    h.request(
      () =>
        getSitemap({
          request: new Request(`${origin}/sitemap.xml`, {
            headers: etag ? { "If-None-Match": etag } : {},
          }),
        } as Parameters<typeof getSitemap>[0]) as Promise<Response>,
    );
  await h.db.youngEvent.create({
    data: { youngId, name: youngId, rawJson: {}, isActive: true },
  });
  await h.db.section.update({
    where: { id: h.catalog.sections[1].id },
    data: { retiredAt: new Date() },
  });
  const first = await read();
  const original = await first.text();
  const etag = first.headers.get("etag");
  expect(etag).toMatch(/^"sha256-/);
  expect(first.headers.get("cache-control")).toBe(
    "public, max-age=0, must-revalidate",
  );
  expect(first.headers.get("cloudflare-cdn-cache-control")).toBe(
    "public, max-age=3600, stale-while-revalidate=21600",
  );
  expect(first.headers.get("cache-tag")).toBe("catalog");
  expect(urls(original)).toContain(
    `${origin}/catalog/sections/${h.catalog.sections[0].jwId}`,
  );
  expect(urls(original)).not.toContain(
    `${origin}/catalog/sections/${h.catalog.sections[1].jwId}`,
  );
  expect(urls(original)).toContain(`${origin}/catalog/young-events/${youngId}`);
  await h.db.section.update({
    where: { id: h.catalog.sections[0].id },
    data: { retiredAt: new Date() },
  });
  await h.db.youngEvent.update({
    where: { youngId },
    data: { isActive: false },
  });
  for (const tier of ["memory", "colo", "kv"]) {
    if (tier !== "memory") resetPublicRuntimeCacheForTest();
    if (tier === "kv") h.colo.clear();
    expect(await (await read()).text(), tier).toBe(original);
  }
  const conditional = await read(`"other", W/${etag}`);
  expect(conditional.status).toBe(304);
  expect(await conditional.text()).toBe("");
  await h.revise("new-sitemap");
  const revised = await read(etag ?? undefined);
  const updated = await revised.text();
  expect(revised.status).toBe(200);
  expect(revised.headers.get("etag")).not.toBe(etag);
  expect(urls(updated)).not.toContain(
    `${origin}/catalog/sections/${h.catalog.sections[0].jwId}`,
  );
  expect(urls(updated)).not.toContain(
    `${origin}/catalog/young-events/${youngId}`,
  );
  const extra = await h.db.course.create({
    data: {
      jwId: h.catalog.base + 9,
      code: `${h.catalog.marker}-new`,
      nameCn: "New sitemap course",
    },
  });
  vi.setSystemTime(h.start + 86_400_000 - 1);
  expect(await (await read()).text()).toBe(updated);
  vi.setSystemTime(h.start + 86_400_000);
  const expired = await read();
  expect(urls(await expired.text())).toContain(
    `${origin}/catalog/courses/${extra.jwId}`,
  );
  expect(expired.headers.get("etag")).not.toBe(revised.headers.get("etag"));
});
