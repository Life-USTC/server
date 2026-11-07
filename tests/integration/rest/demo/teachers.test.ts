import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

test("demo teacher collection isolates live records and matches native search while keeping page API and details consistent", {
  tag: "@Account/REST",
}, async ({ request, isolatedWorker, run }) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    await db.teacher.createMany({
      data: [
        {
          id: 401,
          jwId: 930001,
          code: "DEMO-T01",
          nameCn: "陈老师",
          nameEn: "Teacher Chen",
        },
        {
          id: 402,
          jwId: 930002,
          code: "DEMO-T02",
          nameCn: "林老师",
          nameEn: "Teacher Lin",
        },
        {
          id: 499,
          jwId: 930099,
          code: "LIVE-ONLY",
          nameCn: "真实教师",
          nameEn: "Live-only teacher",
        },
      ],
    });
    const course = await db.course.create({
      data: { jwId: 920001, code: "fixture-course", nameCn: "Fixture" },
    });
    for (const [index, ids] of [
      [0, [401, 402]],
      [1, [401]],
      [2, [402]],
    ] as const)
      await db.section.create({
        data: {
          jwId: 910001 + index,
          code: `fixture-${index}`,
          courseId: course.id,
          teachers: { connect: ids.map((id) => ({ id })) },
        },
      });
    const actor = await isolatedWorker.createActor();
    await db.todo.create({
      data: { userId: actor.id, title: "Private victim task" },
    });
    const snapshot = await db.teacher.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { sections: true } } },
    });
    const searches = [
      "teacher chen",
      "林老师",
      "DEMO-T0_",
      "DEMO-T0\\_",
      "teacher%chen",
      "no match",
      `${"%_".repeat(10)}Z`,
    ];
    const expected = new Map<string, number[]>();
    for (const search of searches) {
      const response = await request.get(
        `/api/catalog/teachers?${new URLSearchParams({ search, locale: "en-us" })}`,
      );
      expect(response.status()).toBe(200);
      expected.set(
        search,
        (await response.json()).data.map(
          (teacher: { id: number }) => teacher.id,
        ),
      );
    }
    for (const cookie of ["", `${actor.cookie.name}=${actor.cookie.value}`]) {
      const ordinary = await request.get(
        "/api/catalog/teachers?search=LIVE-ONLY",
        { headers: { cookie } },
      );
      expect(ordinary.status()).toBe(200);
      expect((await ordinary.json()).data).toMatchObject([{ id: 499 }]);
    }
    const signed = await createSignedDemoCookie({
      issuedAt: Math.floor(Date.now() / 1000),
    });
    const secret = { "x-test-storage-secret": "local-test-storage-observer" };
    const id = crypto.randomUUID();
    const probe = `/__test/community-effects?id=${id}`;
    const headers = {
      ...secret,
      "x-test-community-probe": id,
      cookie: `${signed.name}=${signed.value}; NEXT_LOCALE=en-us`,
      origin: isolatedWorker.origin,
    };
    const errors: unknown[] = [];
    let registered = false;
    try {
      const registration = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      registered = registration.status() === 201;
      await registration.body();
      expect(registration.status()).toBe(201);
      for (const search of searches) {
        const response = await request.get(
          `/api/catalog/teachers?${new URLSearchParams({ search })}`,
          { headers },
        );
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.data.map((teacher: { id: number }) => teacher.id)).toEqual(
          expected.get(search),
        );
        expect(
          body.data.every(
            (teacher: { _count: { sections: number } }) =>
              teacher._count.sections === 2,
          ),
        ).toBe(true);
      }
      for (const [query, ids] of [
        ["pageSize=1", [402]],
        ["pageSize=1&page=2", [401]],
        ["pageSize=1&page=3", []],
        ["search=LIVE-ONLY", []],
        ["departmentId=999999", []],
      ] as const) {
        const response = await request.get(`/api/catalog/teachers?${query}`, {
          headers,
        });
        expect(response.status()).toBe(200);
        expect(
          (await response.json()).data.map(
            (teacher: { id: number }) => teacher.id,
          ),
        ).toEqual(ids);
      }
      for (const path of [
        "/catalog/teachers",
        "/catalog/teachers/__data.json",
        "/catalog/teachers?name=Chen&code=T01",
        "/catalog/teachers?sectionCount=2&sectionCountOp=gte",
        "/catalog/teachers?departmentId=1,2",
        "/catalog/teachers?teacherTitleId=999999",
        "/catalog/teachers?page=2",
        "/catalog/teachers/401",
        "/catalog/teachers/402",
      ]) {
        const response = await request.get(path, { headers });
        expect(response.status(), path).toBe(200);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
          "no-store",
        );
        expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
        const text = await response.text();
        for (const forbidden of [
          "LIVE-ONLY",
          "Private victim task",
          "googletagmanager.com",
          "application/ld+json",
        ])
          expect(text).not.toContain(forbidden);
      }
      for (const [path, status] of [
        ["/api/catalog/teachers?ids=401,499", 400],
        ["/api/catalog/teachers?jwIds=930001,930099", 400],
        ["/api/catalog/teachers?departmentId=1,2", 400],
        ["/api/catalog/teachers?name=Chen", 400],
        ["/api/catalog/teachers?page=101", 400],
        ["/catalog/teachers/499", 404],
        ["/api/catalog/teachers/499", 403],
        ["/api/catalog/links/resolve?slug=jw", 403],
      ] as const) {
        const response = await request.get(path, { headers });
        expect(response.status(), path).toBe(status);
        await response.body();
      }
      for (const method of ["POST", "PATCH", "DELETE"]) {
        const response = await request.fetch("/api/catalog/teachers", {
          method,
          headers,
          data: { id: 499 },
        });
        expect(response.status()).toBe(403);
        await response.body();
      }
      const response = await request.get(probe, { headers: secret });
      const effects = await response.json();
      expect(effects).toMatchObject({
        purges: [],
        messages: [],
        backgroundErrors: [],
        io: { bindings: [], outbound: [] },
      });
      expect(effects.requests.length).toBeGreaterThan(25);
      expect(
        effects.requests.every(
          (entry: { outcome: string }) => entry.outcome === "fulfilled",
        ),
      ).toBe(true);
      expect(
        await db.teacher.findMany({
          orderBy: { id: "asc" },
          include: { _count: { select: { sections: true } } },
        }),
      ).toEqual(snapshot);
      expect(
        await db.todo.count({
          where: { userId: actor.id, title: "Private victim task" },
        }),
      ).toBe(1);
    } catch (error) {
      errors.push(error);
    } finally {
      if (registered)
        try {
          const response = await request.delete(probe, { headers: secret });
          expect(response.status()).toBe(204);
          await response.body();
        } catch (error) {
          errors.push(error);
        }
    }
    if (errors.length)
      throw new AggregateError(
        errors,
        "Demo teacher controls or cleanup failed",
      );
  });
});
