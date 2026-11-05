import { expect } from "@playwright/test";
import { unflatten } from "devalue";
import type { SectionSummaryDto } from "../../../../src/features/catalog/lib/academic-section-list-response-schemas";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const webQueries = [
  "",
  "courseName=Linear&sectionCode=MATH",
  "teacher=Lin&semesterId=2602,2609",
  "teacherCount=1&teacherCountOp=gt",
  "teacherCount=1&teacherCountOp=ne",
  "teacherCount=1&teacherCountOp=between&teacherCountMax=2",
  "credits=3.5&creditsOp=eq",
  "credits=3.5&creditsOp=ne",
  "credits=3.5&creditsOp=gt",
  "credits=3.5&creditsOp=gte",
  "credits=3.5&creditsOp=lt",
  "credits=3.5&creditsOp=lte",
  "credits=3&creditsOp=between&creditsMax=3.5",
  "stdCount=0&stdCountOp=ne",
  "stdCount=0",
  "limitCount=1",
  "semesterId=2602,999999",
  "campusId=1",
  "categoryId=1",
  "classTypeId=1",
  "educationLevelId=1",
  "departmentId=1",
  "search=teacher%3AChen%20credits%3A3&teacher=Lin&credits=4",
  "search=sort%3Acredits%20order%3Adesc&sort=code&order=asc",
  "page=2",
];
const searches = [
  "DEMO",
  "Algebra Chen",
  "teacher:Lin",
  'teacher:"Teacher Chen" credits:3',
  "sectioncode:CS01.01",
  "semester:秋季",
  "campus:East",
  "dept:Math",
  "category:Basic",
  "level:Undergraduate",
  "type:Required",
  "credits:invalid",
  "DEMO-MATH0_",
  "DEMO-MATH0\\_",
  `${"%".repeat(198)}Z`,
  `${"%_".repeat(10)}Z`,
  ...[
    "credits",
    "semester",
    "course",
    "code",
    "teacher",
    "capacity",
    "campus",
  ].flatMap((sort) => [`sort:${sort}`, `sort:${sort} order:desc`]),
];
const normalized = (rows: SectionSummaryDto[]) =>
  rows.map((row) => ({
    ...row,
    teachers: [...row.teachers].sort((a, b) => a.id - b.id),
  }));

test("demo section listing matches native Web and REST filters while isolating data and effects", {
  tag: "@Account/REST",
}, async ({ request, isolatedWorker, run }) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    await db.semester.createMany({
      data: [
        { id: 2602, jwId: 2602, code: "2026-spring", nameCn: "2026年春季学期" },
        { id: 2609, jwId: 2609, code: "2026-autumn", nameCn: "2026年秋季学期" },
      ],
    });
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
      ],
    });
    await db.course.createMany({
      data: [
        {
          id: 201,
          jwId: 920001,
          code: "DEMO-MATH01",
          nameCn: "线性代数",
          nameEn: "Linear Algebra",
        },
        {
          id: 202,
          jwId: 920002,
          code: "DEMO-PHYS01",
          nameCn: "大学物理",
          nameEn: "College Physics",
        },
        {
          id: 203,
          jwId: 920003,
          code: "DEMO-CS01",
          nameCn: "数据结构",
          nameEn: "Data Structures",
        },
        {
          id: 299,
          jwId: 920099,
          code: "LIVE-ONLY",
          nameCn: "真实课程",
          nameEn: "Live-only course",
        },
      ],
    });
    for (const [id, jwId, code, courseId, semesterId, credits, teacherIds] of [
      [101, 910001, "DEMO-MATH01.01", 201, 2609, 4, [401, 402]],
      [102, 910002, "DEMO-PHYS01.01", 202, 2609, 3, [401]],
      [103, 910003, "DEMO-CS01.01", 203, 2602, 3.5, [402]],
      [199, 910099, "LIVE-ONLY.01", 299, 2609, 4, []],
    ] as const)
      await db.section.create({
        data: {
          id,
          jwId,
          code,
          courseId,
          semesterId,
          credits,
          stdCount: jwId === 910099 ? 0 : null,
          teachers: { connect: teacherIds.map((id) => ({ id })) },
        },
      });
    const actor = await isolatedWorker.createActor();
    await db.todo.create({
      data: { userId: actor.id, title: "Private victim task" },
    });
    const snapshot = await db.section.findMany({
      orderBy: { id: "asc" },
      include: { teachers: true },
    });
    const allWeb = [
      ...webQueries,
      ...searches.map((search) => new URLSearchParams({ search }).toString()),
    ];
    const allRest = [
      "",
      ...searches.map((search) => new URLSearchParams({ search }).toString()),
      "courseId=201",
      "courseJwId=920002",
      "courseId=201&courseJwId=920002",
      "semesterId=2602",
      "semesterJwId=2609",
      "teacherId=402",
      "teacherCode=DEMO-T01",
      "teacherId=401&teacherCode=DEMO-T02",
      "ids=101,103",
      "jwIds=910002,910003",
      "ids=101&jwIds=910002",
      "teacherId=999999",
      "campusId=1",
      "departmentId=1",
      "search=DEMO&pageSize=2",
      "search=DEMO&pageSize=2&page=2",
      "search=DEMO&pageSize=2&page=3",
    ];
    type Listing = {
      data: SectionSummaryDto[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };
    const read = async (
      query: string,
      web: boolean,
      headers: Record<string, string>,
    ) => {
      const response = await request.get(
        web
          ? `/catalog/sections/__data.json?${query}`
          : `/api/catalog/sections?${query}&locale=en-us`,
        { headers },
      );
      expect(response.status(), query).toBe(200);
      const body = await response.json();
      return web
        ? (unflatten(body.nodes.at(-1).data) as Listing)
        : (body as Listing);
    };
    const expected = new Map<string, SectionSummaryDto[]>();
    const expectedPagination = new Map<string, Listing["pagination"]>();
    for (const [web, queries] of [
      [true, allWeb],
      [false, allRest],
    ] as const)
      for (const query of queries) {
        const ordinary = await read(query, web, {
          cookie: "NEXT_LOCALE=en-us",
        });
        expected.set(
          `${web}:${query}`,
          normalized(ordinary.data.filter((row) => row.jwId !== 910099)),
        );
        // DEMO search excludes the independently seeded live-only row before
        // pagination, so complete native metadata is directly comparable.
        if (!web && query.startsWith("search=DEMO&pageSize="))
          expectedPagination.set(query, ordinary.pagination);
      }
    for (const cookie of ["", `${actor.cookie.name}=${actor.cookie.value}`]) {
      const ordinary = await read("search=LIVE-ONLY", false, { cookie });
      expect(ordinary.data.map((row) => row.jwId)).toEqual([910099]);
    }
    const signed = await createSignedDemoCookie({
      issuedAt: Math.floor(Date.now() / 1000),
    });
    const secret = { "x-test-storage-secret": "local-test-storage-observer" };
    const id = crypto.randomUUID(),
      probe = `/__test/community-effects?id=${id}`;
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
      for (const [web, queries] of [
        [true, allWeb],
        [false, allRest],
      ] as const)
        for (const query of queries) {
          const result = await read(query, web, headers);
          expect(normalized(result.data), `${web}:${query}`).toEqual(
            expected.get(`${web}:${query}`),
          );
          if (!web && expectedPagination.has(query)) {
            expect(result.pagination, query).toEqual(
              expectedPagination.get(query),
            );
            expect(result.pagination).toMatchObject({
              total: 3,
              totalPages: 2,
              pageSize: 2,
            });
          }
        }
      for (const path of [
        "/catalog/sections",
        "/catalog/sections?semesterId=999999",
        "/catalog/sections?search=LIVE-ONLY",
        "/api/catalog/sections?search=LIVE-ONLY",
      ]) {
        const response = await request.get(path, { headers });
        expect(response.status()).toBe(200);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
          "no-store",
        );
        expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
        const text = await response.text();
        expect(text).not.toContain("Live-only course");
        expect(text).not.toContain("Private victim task");
        expect(text).not.toContain("googletagmanager.com");
        expect(text).not.toContain("application/ld+json");
      }
      for (const [query, status] of [
        ["ids=101,199", 404],
        ["jwIds=910001,910099", 404],
        ["ids=bad,101", 400],
        ["ids=101&ids=199", 400],
        ["userId=victim", 400],
      ] as const) {
        const response = await request.get(
          `/api/catalog/sections?${query}&locale=en-us`,
          {
            headers,
          },
        );
        expect(response.status()).toBe(status);
        await response.body();
      }
      for (const method of ["POST", "PATCH", "DELETE"]) {
        const response = await request.fetch("/api/catalog/sections", {
          method,
          headers,
          data: { id: 199 },
        });
        expect(response.status()).toBe(403);
        await response.body();
      }
      const collected = await request.get(probe, { headers: secret });
      const effects = await collected.json();
      expect(effects).toMatchObject({
        purges: [],
        messages: [],
        backgroundErrors: [],
        io: { bindings: [], outbound: [] },
      });
      expect(effects.requests.length).toBeGreaterThan(
        allWeb.length + allRest.length,
      );
      expect(
        effects.requests.every(
          (item: { outcome: string }) => item.outcome === "fulfilled",
        ),
      ).toBe(true);
      expect(
        await db.section.findMany({
          orderBy: { id: "asc" },
          include: { teachers: true },
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
        "Demo section control or cleanup failed",
      );
  });
});
