import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { searchGlobally } from "@/features/search/server/global-search-service";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getGlobalSearchRoute } from "@/lib/api/routes/global-search";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import { getCanonicalOrigin } from "@/lib/site-url";
import { GET as getSitemap } from "@/routes/sitemap.xml/+server";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../shared/catalog-contract-fixture";
import { createFixturePrisma } from "../shared/prisma";

async function fixture() {
  const db = createFixturePrisma();
  const catalog = await createCatalogContractFixture(db);
  const previousRevision = await db.staticImportState.findUnique({
    where: { id: "global" },
  });
  const start = new Date("2031-01-12T00:00:00.000Z").getTime();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(start);
  resetPublicRuntimeCacheForTest();
  const kv = new Map<string, string>();
  const colo = new Map<string, Response>();
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async (request: Request) => colo.get(request.url)?.clone(),
      put: async (request: Request, response: Response) => {
        colo.set(request.url, response.clone());
      },
    }),
  });
  const users = await Promise.all(
    [0, 1].map((index) =>
      db.user.create({
        data: {
          id: `${catalog.marker}-cache-${index}`,
          email: `${catalog.marker}-cache-${index}@test.invalid`,
        },
      }),
    ),
  );
  async function revise(label: string) {
    const data = {
      snapshotGeneratedAt: new Date(),
      snapshotSha256: createHash("sha256")
        .update(`${catalog.marker}-${label}`)
        .digest("hex"),
      transformRevision: 1,
      updatedAt: new Date(),
    };
    await db.staticImportState.upsert({
      where: { id: "global" },
      create: { id: "global", ...data },
      update: data,
    });
  }
  await revise("initial");
  async function request<T>(read: () => Promise<T>) {
    const pending: Promise<unknown>[] = [];
    const result = await runWithCloudflareRuntimeEnv(
      {
        HYPERDRIVE: { connectionString: process.env.DATABASE_URL ?? "" },
        HYPERDRIVE_AUTH: {
          connectionString: process.env.AUTH_DATABASE_URL ?? "",
        },
        CATALOG_DETAIL_CORE: {
          get: async (key: string) => {
            const value = kv.get(key);
            return value ? JSON.parse(value) : null;
          },
          put: async (key: string, value: string) => {
            kv.set(key, value);
          },
        },
      },
      read,
      { waitUntil: (promise: Promise<unknown>) => pending.push(promise) },
    );
    await Promise.all(pending);
    return result;
  }
  return {
    db,
    catalog,
    users,
    start,
    kv,
    colo,
    request,
    revise,
    async close() {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      resetPublicRuntimeCacheForTest();
      if (previousRevision)
        await db.staticImportState.update({
          where: { id: "global" },
          data: previousRevision,
        });
      else await db.staticImportState.delete({ where: { id: "global" } });
      await cleanupCatalogContractFixture(db, catalog);
      await db.user.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
      await db.$disconnect();
    },
  };
}

it("rendering-and-cache.global-search-freshness", async () => {
  const h = await fixture();
  const query = h.catalog.marker;
  const courseId = h.catalog.courses[0].id;
  const courseKey = `course:${h.catalog.courses[0].jwId}`;
  const read = (
    userId?: string,
    locale: "zh-cn" | "en-us" = "zh-cn",
    limit = 10,
  ) =>
    h.request(() =>
      searchGlobally({
        query: ` ${query} `,
        userId,
        locale,
        limit,
        origin: getCanonicalOrigin(),
      }),
    );
  const title = (result: Awaited<ReturnType<typeof read>>) =>
    result.groups
      .find((group) => group.type === "courses")
      ?.items.find((item) => item.id === courseKey)?.title;
  try {
    await h.db.course.update({
      where: { id: courseId },
      data: { nameCn: `${query} before`, nameEn: `${query} English` },
    });
    const todos = await Promise.all(
      h.users.map((user) =>
        h.db.todo.create({
          data: { userId: user.id, title: `${query} private ${user.id}` },
        }),
      ),
    );
    const homeworks = await Promise.all(
      h.users.map((user, index) =>
        h.db.homework.create({
          data: {
            sectionId: h.catalog.sections[index].id,
            createdById: user.id,
            title: `${query} homework ${index}`,
          },
        }),
      ),
    );
    for (const [index, user] of h.users.entries())
      await h.db.userSectionSubscription.create({
        data: { userId: user.id, sectionId: h.catalog.sections[index].id },
      });
    for (const [index, user] of h.users.entries()) {
      const result = await read(user.id);
      expect(title(result)).toBe(`${query} before`);
      expect(
        result.groups
          .find((group) => group.type === "todos")
          ?.items.map((item) => item.id),
      ).toEqual([`todo:${todos[index].id}`]);
      expect(
        result.groups
          .find((group) => group.type === "homeworks")
          ?.items.map((item) => item.id),
      ).toEqual([`homework:${homeworks[index].id}`]);
    }
    expect(
      (await read()).groups.every(
        (group) => !["todos", "homeworks"].includes(group.type),
      ),
    ).toBe(true);
    expect(title(await read(undefined, "en-us"))).toBe(`${query} English`);
    const publicResponse = await h.request(() =>
      getGlobalSearchRoute(
        new Request(`${getCanonicalOrigin()}/api/search?q=${query}`),
      ),
    );
    expect(publicResponse.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=120, stale-while-revalidate=300",
    );
    expect(publicResponse.headers.get("cloudflare-cdn-cache-control")).toBe(
      "public, max-age=120, stale-while-revalidate=300",
    );
    expect(publicResponse.headers.get("cache-tag")).toBe("catalog");
    const publicBody = await publicResponse.json();
    expect(
      publicBody.groups.every(
        (group: { type: string }) =>
          !["todos", "homeworks"].includes(group.type),
      ),
    ).toBe(true);
    expect(
      (await read(undefined, "zh-cn", 1)).groups.find(
        (group) => group.type === "courses",
      )?.items,
    ).toHaveLength(1);
    await h.db.course.update({
      where: { id: courseId },
      data: { nameCn: `${query} after clock` },
    });
    await h.db.todo.update({
      where: { id: todos[0].id },
      data: { title: `${query} private changed` },
    });
    await h.db.homework.update({
      where: { id: homeworks[0].id },
      data: { title: `${query} homework changed` },
    });
    await h.db.userSectionSubscription.deleteMany({
      where: { userId: h.users[1].id },
    });
    vi.setSystemTime(h.start + 299_999);
    for (const tier of ["memory", "colo", "kv"]) {
      if (tier !== "memory") resetPublicRuntimeCacheForTest();
      if (tier === "kv") h.colo.clear();
      const result = await read(h.users[0].id);
      expect(title(result), tier).toBe(`${query} before`);
      expect(
        result.groups.find((group) => group.type === "todos")?.items[0].title,
      ).toBe(`${query} private changed`);
      expect(
        result.groups.find((group) => group.type === "homeworks")?.items[0]
          .title,
      ).toBe(`${query} homework changed`);
      expect(
        (await read(h.users[1].id)).groups.some(
          (group) => group.type === "homeworks",
        ),
      ).toBe(false);
    }
    for (const value of h.kv.values())
      for (const privateId of [
        ...h.users.map((user) => user.id),
        ...todos.map((todo) => todo.id),
        ...homeworks.map((homework) => homework.id),
      ])
        expect(value).not.toContain(privateId);
    vi.setSystemTime(h.start + 300_000);
    expect(title(await read(h.users[0].id))).toBe(`${query} after clock`);
    await h.db.course.update({
      where: { id: courseId },
      data: { nameCn: `${query} after revision` },
    });
    await h.revise("changed");
    expect(title(await read())).toBe(`${query} after revision`);
  } finally {
    await h.close();
  }
});

it("rendering-and-cache.sitemap-freshness", async () => {
  const h = await fixture();
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
  try {
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
    expect(urls(original)).toContain(
      `${origin}/catalog/young-events/${youngId}`,
    );
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
  } finally {
    await h.db.youngEvent.deleteMany({ where: { youngId } });
    await h.close();
  }
});
