import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";
import { createPublicParityClient } from "./_public-parity";

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
function identities(rows: Identity[]) {
  return rows.map(({ id, jwId, code }) => ({ id, jwId, code }));
}
function createCatalogReaders(origin: string) {
  const { rest: read, graph, mcp } = createPublicParityClient(origin);
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
    const rest: Page = await read(`/api/catalog/${kind}s?${params}`);
    const graphResult = await graph(
      `query Parity($filter: ${kind[0].toUpperCase() + kind.slice(1)}Filter, $page: PageInput) { catalog { ${kind}s(filter: $filter, page: $page) { items { id jwId code } pageInfo { page pageSize total totalPages } } } }`,
      { filter, page: { page, pageSize } },
    );
    const tools: Page = await mcp(`catalog_${kind}_search`, {
      ...filter,
      page,
      limit: pageSize,
    });
    const expected = {
      data: identities(rest.data),
      pagination: rest.pagination,
    };
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
    const rest = await read(`/api/catalog/${kind}s/${id}?locale=zh-cn`);
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
  return { comparePage, compareDetail };
}
test("interface-hierarchy.catalog-explicit-read-parity", async ({
  isolatedWorker,
  run,
}) =>
  run(async () => {
    const db = isolatedWorker.database.owner;
    const { comparePage, compareDetail } = createCatalogReaders(
      isolatedWorker.origin,
    );
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
      const teacher = await db.teacher.create({
        data: {
          jwId: fixture.base + offset,
          code: `${tieMarker}-${offset}`,
          nameCn: tieMarker,
        },
      });
      const section = await db.section.create({
        data: {
          jwId: fixture.base + offset,
          code: tieMarker,
          courseId: course.id,
          semesterId: fixture.semester.id,
        },
      });
      tied.course.unshift(course.id);
      tied.teacher.unshift(teacher.id);
      tied.section.unshift(section.id);
    }
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
  }));
