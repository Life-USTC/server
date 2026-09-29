import { expect, vi } from "vitest";
import { searchGlobally } from "@/features/search/server/global-search-service";
import { getGlobalSearchRoute } from "@/lib/api/routes/global-search";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import { getCanonicalOrigin } from "@/lib/site-url";
import { publicDiscoveryTest as it } from "../shared/public-discovery-fixture";

// This isolated one-case file controls Date and tests production tier selection
// with real PostgreSQL and controlled colo/KV bindings.
it("rendering-and-cache.global-search-freshness", async ({ discovery: h }) => {
  await h.run(async () => {
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
    for (const tier of ["memory", "colo", "kv"] as const) {
      // Deliberate within-case eviction selects the tier under test.
      if (tier !== "memory") resetPublicRuntimeCacheForTest();
      if (tier === "kv") h.colo.clear();
      const observedAt = h.analytics.length;
      const result = await read(h.users[0].id);
      expect(title(result), tier).toBe(`${query} before`);
      const cacheHits = h.analytics
        .slice(observedAt)
        .filter(
          (point) =>
            point.blobs?.[0] === "public_runtime_cache_v3" &&
            point.blobs?.[2] === "search:catalog:v5:zh-cn" &&
            ["hit", "colo_hit", "kv_hit", "load_success"].includes(
              String(point.blobs?.[1]),
            ),
        );
      expect(
        cacheHits.map((point) => ({
          index: point.indexes?.[0],
          event: point.blobs?.[1],
          ttlMs: point.doubles?.[1],
        })),
        tier,
      ).toEqual([
        {
          index: "cache:search:catalog:v5:zh-cn",
          event: { memory: "hit", colo: "colo_hit", kv: "kv_hit" }[tier],
          ttlMs: 300000,
        },
      ]);
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
  });
});
