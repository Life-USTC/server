import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, expect, it } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  getCourseDetailRoute,
  getCoursesRoute,
} from "@/lib/api/routes/academic-course-routes";
import {
  getSectionDetailRoute,
  getSectionsRoute,
} from "@/lib/api/routes/academic-section-routes";
import {
  getTeacherDetailRoute,
  getTeachersRoute,
} from "@/lib/api/routes/academic-teacher-routes";
import { mcpPostRoute } from "@/lib/api/routes/mcp";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../shared/catalog-contract-fixture";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const graphql = createGraphqlRequestHandler(false);
const origin = "http://localhost:3000";
type Kind = "course" | "section" | "teacher";
type Filter = Record<string, string | number | number[]>;
type Identity = { id: number; jwId: number; code: string | null };
type Page = {
  data: Identity[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
function runtime<T>(work: () => T) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("Missing application runtime database URL");
  return runWithCloudflareRuntimeEnv(
    { HYPERDRIVE: { connectionString } },
    work,
  );
}
function identities(rows: Identity[]) {
  return rows.map(({ id, jwId, code }) => ({ id, jwId, code }));
}
async function graph(document: string, variables: Record<string, unknown>) {
  const request = new Request(`${origin}/api/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
  });
  const response = await runtime(() =>
    graphql({
      request,
      locals: { authUser: null, locale: "zh-cn", requestId: "catalog-parity" },
    } as unknown as RequestEvent),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.errors).toBeUndefined();
  return body.data.catalog;
}
async function mcp(name: string, args: Record<string, unknown>) {
  const request = new Request(`${origin}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: { ...args, mode: "full", locale: "zh-cn" } },
    }),
  });
  const response = await runtime(() => mcpPostRoute(request));
  expect(response.status).toBe(200);
  const text = await response.text();
  const data = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .at(-1)
        ?.slice(6)
    : text;
  if (!data) throw new Error("MCP HTTP response has no JSON-RPC data");
  const body = JSON.parse(data);
  expect(body.error).toBeUndefined();
  expect(body.result.isError).not.toBe(true);
  return JSON.parse(
    body.result.content.find((part: { type: string }) => part.type === "text")
      .text,
  );
}
async function comparePage(
  kind: Kind,
  filter: Filter,
  page: number,
  pageSize: number,
  expectedIds: number[],
  expectedTotal: number,
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    locale: "zh-cn",
  });
  for (const [key, value] of Object.entries(filter))
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  const handlers = {
    course: getCoursesRoute,
    section: getSectionsRoute,
    teacher: getTeachersRoute,
  };
  const response = await runtime(() =>
    handlers[kind](new Request(`${origin}/api/catalog/${kind}s?${params}`)),
  );
  expect(response.status).toBe(200);
  const rest: Page = await response.json();
  const graphResult = await graph(
    `query Parity($filter: ${kind[0].toUpperCase() + kind.slice(1)}Filter, $page: PageInput) { catalog { ${kind}s(filter: $filter, page: $page) { items { id jwId code } pageInfo { page pageSize total totalPages } } } }`,
    { filter, page: { page, pageSize } },
  );
  const tools: Page = await mcp(`catalog_${kind}_search`, {
    ...filter,
    page,
    limit: pageSize,
  });
  const expected = { data: identities(rest.data), pagination: rest.pagination };
  expect({
    data: identities(graphResult[`${kind}s`].items),
    pagination: graphResult[`${kind}s`].pageInfo,
  }).toEqual(expected);
  expect({
    data: identities(tools.data),
    pagination: tools.pagination,
  }).toEqual(expected);
  expect(rest.data.map((row) => row.id)).toEqual(expectedIds);
  expect(rest.pagination).toEqual({
    page,
    pageSize,
    total: expectedTotal,
    totalPages: Math.max(1, Math.ceil(expectedTotal / pageSize)),
  });
}
async function compareDetail(kind: Kind, identity: Identity) {
  const key = kind === "teacher" ? "id" : "jwId";
  const id = identity[key];
  expect(identity.id).not.toBe(identity.jwId);
  const request = new Request(
    `${origin}/api/catalog/${kind}s/${id}?locale=zh-cn`,
  );
  const response = await runtime(() =>
    kind === "course"
      ? getCourseDetailRoute(request, { jwId: String(id) })
      : kind === "section"
        ? getSectionDetailRoute(request, { jwId: String(id) })
        : getTeacherDetailRoute(request, { id: String(id) }),
  );
  expect(response.status).toBe(200);
  const rest = await response.json();
  const result = await graph(
    `query Identity($id: Int!) { catalog { ${kind}(${key}: $id) { id jwId code } } }`,
    { id },
  );
  const tools = await mcp(`catalog_${kind}_get`, { [key]: id });
  expect(tools.found).toBe(true);
  expect(identities([rest])[0]).toEqual(identity);
  expect(result[kind]).toEqual(identity);
  expect(identities([tools[kind]])[0]).toEqual(identity);
}
afterAll(() => db.$disconnect());

it("interface-hierarchy.catalog-explicit-read-parity", async () => {
  const fixture = await createCatalogContractFixture(db);
  const category = await db.courseCategory.create({
    data: { nameCn: `${fixture.marker}-category` },
  });
  const classType = await db.classType.create({
    data: { nameCn: `${fixture.marker}-class` },
  });
  const educationLevel = await db.educationLevel.create({
    data: { nameCn: `${fixture.marker}-level` },
  });
  const campus = await db.campus.create({
    data: { jwId: fixture.base, code: fixture.marker, nameCn: "契约校区" },
  });
  const newer = await db.semester.create({
    data: {
      jwId: fixture.base + 1,
      code: `${fixture.marker}-newer`,
      nameCn: "2027春",
    },
  });
  fixture.cleanupIds.semesters.push(newer.id);
  try {
    const [courseA, courseB] = fixture.courses;
    const [sectionA, sectionB] = fixture.sections;
    const [teacherA, teacherB] = fixture.teachers;
    await db.course.update({
      where: { id: courseA.id },
      data: {
        code: `Z-${fixture.marker}`,
        categoryId: category.id,
        classTypeId: classType.id,
        educationLevelId: educationLevel.id,
      },
    });
    await db.course.update({
      where: { id: courseB.id },
      data: { code: `A-${fixture.marker}` },
    });
    await db.teacher.update({
      where: { id: teacherA.id },
      data: { nameCn: `Z-${fixture.marker}` },
    });
    await db.teacher.update({
      where: { id: teacherB.id },
      data: { nameCn: `A-${fixture.marker}` },
    });
    await db.section.update({
      where: { id: sectionA.id },
      data: {
        code: `Z-${fixture.marker}`,
        campusId: campus.id,
        openDepartmentId: fixture.departments[0].id,
      },
    });
    await db.section.update({
      where: { id: sectionB.id },
      data: {
        code: `A-${fixture.marker}`,
        semesterId: newer.id,
        openDepartmentId: fixture.departments[1].id,
      },
    });
    resetPublicRuntimeCacheForTest();
    // Course/Teacher expose fixed ordering, not a caller-supplied sort field.
    for (const kind of ["course", "teacher"] as const) {
      const records = kind === "course" ? fixture.courses : fixture.teachers;
      await comparePage(
        kind,
        { search: fixture.marker },
        1,
        1,
        [records[1].id],
        2,
      );
      await comparePage(
        kind,
        { search: fixture.marker },
        2,
        1,
        [records[0].id],
        2,
      );
      await comparePage(kind, { search: fixture.marker }, 3, 1, [], 2);
    }
    const courseFilters: Filter[] = [
      { categoryId: category.id },
      { classTypeId: classType.id },
      { educationLevelId: educationLevel.id },
      {
        categoryId: category.id,
        classTypeId: classType.id,
        educationLevelId: educationLevel.id,
      },
    ];
    for (const filter of courseFilters) {
      await comparePage(
        "course",
        { search: fixture.marker, ...filter },
        1,
        2,
        [courseA.id],
        1,
      );
    }
    await comparePage(
      "teacher",
      { search: fixture.marker, departmentId: fixture.departments[0].id },
      1,
      2,
      [teacherA.id],
      1,
    );
    await comparePage(
      "teacher",
      { search: fixture.marker, departmentId: fixture.departments[1].id },
      1,
      2,
      [teacherB.id],
      1,
    );
    // The shared advanced search syntax is the common explicit Section sort input.
    const ascending = `${fixture.marker} sort:code order:asc`;
    const descending = `${fixture.marker} sort:code order:desc`;
    await comparePage("section", { search: ascending }, 1, 1, [sectionB.id], 2);
    await comparePage("section", { search: ascending }, 2, 1, [sectionA.id], 2);
    await comparePage(
      "section",
      { search: descending },
      1,
      1,
      [sectionA.id],
      2,
    );
    await comparePage(
      "section",
      { search: descending },
      2,
      1,
      [sectionB.id],
      2,
    );
    await comparePage(
      "section",
      { search: fixture.marker },
      1,
      1,
      [sectionB.id],
      2,
    );
    const sectionFilters: Filter[] = [
      { courseId: courseA.id },
      { courseJwId: courseA.jwId },
      { courseId: courseA.id, courseJwId: courseA.jwId },
      { semesterId: fixture.semester.id },
      { semesterJwId: fixture.semester.jwId },
      { campusId: campus.id },
      { departmentId: fixture.departments[0].id },
      { teacherId: teacherA.id },
      { teacherCode: teacherA.code ?? "" },
      { ids: [sectionA.id] },
      { jwIds: [sectionA.jwId] },
      { ids: [sectionA.id, sectionB.id], jwIds: [sectionA.jwId] },
    ];
    for (const filter of sectionFilters) {
      await comparePage(
        "section",
        { search: descending, ...filter },
        1,
        2,
        [sectionA.id],
        1,
      );
    }
    const emptySectionFilters: Filter[] = [
      { courseId: courseA.id, courseJwId: courseB.jwId },
      { semesterId: fixture.semester.id, semesterJwId: newer.jwId },
      { ids: [sectionA.id], jwIds: [sectionB.jwId] },
      { ids: [sectionA.jwId] },
      { jwIds: [sectionA.id] },
    ];
    for (const filter of emptySectionFilters) {
      await comparePage(
        "section",
        { search: descending, ...filter },
        1,
        2,
        [],
        0,
      );
    }
    for (const kind of ["course", "section", "teacher"] as const) {
      const records =
        kind === "course"
          ? await db.course.findMany({
              where: { id: { in: fixture.courses.map((row) => row.id) } },
            })
          : kind === "section"
            ? await db.section.findMany({
                where: { id: { in: fixture.sections.map((row) => row.id) } },
              })
            : await db.teacher.findMany({
                where: { id: { in: fixture.teachers.map((row) => row.id) } },
              });
      for (const record of records)
        await compareDetail(kind, identities([record])[0]);
      await comparePage(
        kind,
        { search: `${fixture.marker}-missing` },
        1,
        2,
        [],
        0,
      );
    }
    // Equal display keys must keep a stable unique order across page boundaries.
    // Insert the larger JW IDs first so heap/insertion order cannot satisfy it.
    const tieMarker = `${fixture.marker}-ties`;
    const tied = {
      course: [] as number[],
      teacher: [] as number[],
      section: [] as number[],
    };
    for (const offset of [15, 14, 13, 12, 11, 10]) {
      const course = await db.course.create({
        data: {
          jwId: fixture.base + offset,
          code: tieMarker,
          nameCn: tieMarker,
        },
      });
      fixture.cleanupIds.courses.push(course.id);
      const teacher = await db.teacher.create({
        data: {
          jwId: fixture.base + offset,
          code: `${tieMarker}-${offset}`,
          nameCn: tieMarker,
        },
      });
      fixture.cleanupIds.teachers.push(teacher.id);
      const section = await db.section.create({
        data: {
          jwId: fixture.base + offset,
          code: tieMarker,
          courseId: course.id,
          semesterId: fixture.semester.id,
        },
      });
      fixture.cleanupIds.sections.push(section.id);
      tied.course.unshift(course.id);
      tied.teacher.unshift(teacher.id);
      tied.section.unshift(section.id);
    }
    resetPublicRuntimeCacheForTest();
    for (const kind of ["course", "teacher", "section"] as const) {
      const searches =
        kind === "section"
          ? [
              tieMarker,
              `${tieMarker} sort:code order:asc`,
              `${tieMarker} sort:code order:desc`,
            ]
          : [tieMarker];
      for (const search of searches) {
        for (const page of [1, 2, 3, 4]) {
          await comparePage(
            kind,
            { search },
            page,
            2,
            tied[kind].slice((page - 1) * 2, page * 2),
            6,
          );
        }
      }
    }
  } finally {
    await cleanupCatalogContractFixture(db, fixture);
    await db.campus.delete({ where: { id: campus.id } });
    await db.courseCategory.delete({ where: { id: category.id } });
    await db.classType.delete({ where: { id: classType.id } });
    await db.educationLevel.delete({ where: { id: educationLevel.id } });
    resetPublicRuntimeCacheForTest();
  }
});
