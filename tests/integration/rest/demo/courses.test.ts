import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

test("demo course listing isolates live data and agrees with native catalog query semantics", {
  tag: "@Account/REST",
}, async ({ request, isolatedWorker, run }) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    // Independent ordinary data: matching public records plus a live-only sentinel.
    await db.course.createMany({
      data: [
        {
          jwId: 920001,
          code: "DEMO-MATH01",
          nameCn: "线性代数",
          nameEn: "Linear Algebra",
        },
        {
          jwId: 920002,
          code: "DEMO-PHYS01",
          nameCn: "大学物理",
          nameEn: "College Physics",
        },
        {
          jwId: 920003,
          code: "DEMO-CS01",
          nameCn: "数据结构",
          nameEn: "Data Structures",
        },
        {
          jwId: 920099,
          code: "LIVE-ONLY",
          nameCn: "真实课程",
          nameEn: "Live-only course",
        },
      ],
    });
    const actor = await isolatedWorker.createActor();
    await db.todo.create({
      data: { userId: actor.id, title: "Private victim task" },
    });
    const snapshot = await db.course.findMany({ orderBy: { jwId: "asc" } });
    const queries = [
      "DEMO-",
      "linear algebra",
      "linear%algebra",
      "DEMO-MATH0_",
      "DEMO-MATH0\\_",
      "数据",
      "no match",
      `${"%".repeat(198)}Z`,
      `${"%_".repeat(10)}Z`,
    ];
    const expected = new Map<string, number[]>();
    for (const search of queries) {
      const response = await request.get(
        `/api/catalog/courses?${new URLSearchParams({ search, locale: "en-us" })}`,
      );
      expect(response.status()).toBe(200);
      expected.set(
        search,
        (await response.json()).data.map((c: { jwId: number }) => c.jwId),
      );
    }
    for (const cookie of ["", `${actor.cookie.name}=${actor.cookie.value}`]) {
      const ordinary = await request.get(
        "/api/catalog/courses?search=LIVE-ONLY",
        { headers: { cookie } },
      );
      expect(ordinary.status()).toBe(200);
      expect((await ordinary.json()).data).toMatchObject([{ jwId: 920099 }]);
    }

    const signed = await createSignedDemoCookie({
      issuedAt: Math.floor(Date.now() / 1000),
    });
    const secret = { "x-test-storage-secret": "local-test-storage-observer" };
    const id = crypto.randomUUID();
    const probePath = `/__test/community-effects?id=${id}`;
    const headers = {
      ...secret,
      "x-test-community-probe": id,
      cookie: `${signed.name}=${signed.value}; NEXT_LOCALE=en-us`,
      origin: isolatedWorker.origin,
    };
    const errors: unknown[] = [];
    let registered = false;
    try {
      const registration = await request.post(`${probePath}&io=1`, {
        headers: secret,
      });
      registered = registration.status() === 201;
      await registration.body();
      expect(registration.status()).toBe(201);
      for (const search of queries) {
        const response = await request.get(
          `/api/catalog/courses?${new URLSearchParams({ search })}`,
          { headers },
        );
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.data.map((c: { jwId: number }) => c.jwId)).toEqual(
          expected.get(search),
        );
        expect(body.pagination.total).toBe(expected.get(search)?.length);
      }
      for (const [query, ids] of [
        ["pageSize=2", [920003, 920001]],
        ["pageSize=2&page=2", [920002]],
        ["pageSize=2&page=3", []],
        ["search=LIVE-ONLY", []],
        ["categoryId=999999", []],
      ] as const) {
        const response = await request.get(`/api/catalog/courses?${query}`, {
          headers,
        });
        expect(response.status()).toBe(200);
        expect(
          (await response.json()).data.map((c: { jwId: number }) => c.jwId),
        ).toEqual(ids);
      }
      for (const path of [
        "/catalog/courses",
        "/catalog/courses/__data.json",
        "/api/catalog/courses",
        "/catalog/courses?name=Linear&code=MATH",
        "/catalog/courses?categoryId=201,999999",
        "/catalog/courses?page=2",
      ]) {
        const response = await request.get(path, { headers });
        expect(response.status(), path).toBe(200);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
          "no-store",
        );
        expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
        const text = await response.text();
        expect(text).not.toContain("LIVE-ONLY");
        expect(text).not.toContain("Private victim task");
        expect(text).not.toContain("googletagmanager.com");
        expect(text).not.toContain("application/ld+json");
      }
      for (const [path, status] of [
        ["/api/catalog/courses?ids=201,999999", 400],
        ["/api/catalog/courses?jwIds=920001,920099", 400],
        ["/api/catalog/courses?categoryId=1,2", 400],
        ["/api/catalog/courses?page=101", 400],
        ["/catalog/courses/920099", 404],
        [
          "/api/community/comments?targetType=course&targetId=201&courseJwId=920099",
          404,
        ],
        ["/catalog/rooms", 403],
        ["/catalog/sections/910001/private", 403],
        ["/api/catalog/links/resolve?slug=jw", 403],
      ] as const) {
        const response = await request.get(path, { headers });
        expect(response.status(), path).toBe(status);
        await response.body();
      }
      for (const method of ["POST", "PATCH", "DELETE"]) {
        const response = await request.fetch("/api/catalog/courses", {
          method,
          headers,
          data: { jwId: 920099 },
        });
        expect(response.status()).toBe(403);
        await response.body();
      }
      const collected = await request.get(probePath, { headers: secret });
      const effects = await collected.json();
      expect(effects).toMatchObject({
        purges: [],
        messages: [],
        backgroundErrors: [],
        io: { bindings: [], outbound: [] },
      });
      expect(effects.requests.length).toBeGreaterThan(20);
      expect(
        effects.requests.every(
          (entry: { outcome: string }) => entry.outcome === "fulfilled",
        ),
      ).toBe(true);
      expect(await db.course.findMany({ orderBy: { jwId: "asc" } })).toEqual(
        snapshot,
      );
      expect(
        await db.todo.count({
          where: { userId: actor.id, title: "Private victim task" },
        }),
      ).toBe(1);
    } catch (error) {
      errors.push(error);
    } finally {
      if (registered) {
        try {
          const removed = await request.delete(probePath, { headers: secret });
          expect(removed.status()).toBe(204);
          await removed.body();
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Demo course control or cleanup failed");
  });
});
