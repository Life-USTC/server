import {
  type CatalogListPath,
  catalogTableFilterValues,
} from "@/features/catalog/lib/catalog-list-query";
import { Prisma } from "@/generated/prisma/client";
import { searchTerms } from "@/lib/query-filter-helpers";
import { parseSectionSearchQuery } from "./section-search-parser";

export type CatalogTableFilters = Record<string, string | undefined>;
export type CatalogTableKind = "courses" | "teachers" | "sections";

const column = (alias: string, field: string) =>
  Prisma.raw(`"${alias}"."${field}"`);
const contains = (expression: Prisma.Sql, value: string) =>
  Prisma.sql`${expression} ILIKE ${`%${value}%`}`;
const nameContains = (alias: string, value: string) =>
  Prisma.sql`(${contains(column(alias, "nameCn"), value)} OR ${contains(column(alias, "nameEn"), value)})`;
const teacherCount = Prisma.sql`(SELECT COUNT(*) FROM "_SectionTeachers" AS "st" WHERE "st"."A" = "s"."id")`;
const sectionCount = Prisma.sql`(SELECT COUNT(*) FROM "_SectionTeachers" AS "st" JOIN "Section" AS "active" ON "active"."id" = "st"."A" WHERE "st"."B" = "t"."id" AND "active"."retiredAt" IS NULL)`;
const teacherContains = (value: string) =>
  Prisma.sql`EXISTS (SELECT 1 FROM "_SectionTeachers" AS "st" JOIN "Teacher" AS "t" ON "t"."id" = "st"."B" WHERE "st"."A" = "s"."id" AND ${nameContains("t", value)})`;

function addIds(
  conditions: Prisma.Sql[],
  filters: CatalogTableFilters,
  key: string,
  expression: Prisma.Sql,
) {
  if (filters[key])
    conditions.push(
      Prisma.sql`${expression} IN (${Prisma.join(filters[key].split(",").map(Number))})`,
    );
}

function addText(
  conditions: Prisma.Sql[],
  filters: CatalogTableFilters,
  key: string,
  expression: Prisma.Sql,
) {
  if (filters[key]) conditions.push(contains(expression, filters[key]));
}

function addNumeric(
  conditions: Prisma.Sql[],
  filters: CatalogTableFilters,
  key: string,
  expression: Prisma.Sql,
) {
  const input = filters[key];
  if (input === undefined) return;
  const value = Number(input);
  switch (filters[`${key}Op`] ?? "eq") {
    case "eq":
      conditions.push(Prisma.sql`${expression} = ${value}`);
      break;
    case "ne":
      conditions.push(Prisma.sql`${expression} <> ${value}`);
      break;
    case "gt":
      conditions.push(Prisma.sql`${expression} > ${value}`);
      break;
    case "gte":
      conditions.push(Prisma.sql`${expression} >= ${value}`);
      break;
    case "lt":
      conditions.push(Prisma.sql`${expression} < ${value}`);
      break;
    case "lte":
      conditions.push(Prisma.sql`${expression} <= ${value}`);
      break;
    case "between":
      conditions.push(
        Prisma.sql`${expression} BETWEEN ${value} AND ${Number(filters[`${key}Max`])}`,
      );
      break;
  }
}

function courseConditions(filters: CatalogTableFilters) {
  const conditions: Prisma.Sql[] = [];
  for (const key of ["categoryId", "classTypeId", "educationLevelId"])
    addIds(conditions, filters, key, column("c", key));
  if (filters.name) conditions.push(nameContains("c", filters.name));
  addText(conditions, filters, "code", column("c", "code"));
  if (filters.search)
    conditions.push(
      Prisma.sql`(${nameContains("c", filters.search)} OR ${contains(column("c", "code"), filters.search)})`,
    );
  return conditions;
}

function teacherConditions(filters: CatalogTableFilters) {
  const conditions: Prisma.Sql[] = [];
  for (const key of ["departmentId", "teacherTitleId"])
    addIds(conditions, filters, key, column("t", key));
  if (filters.name) conditions.push(nameContains("t", filters.name));
  for (const key of ["code", "email"])
    addText(conditions, filters, key, column("t", key));
  if (filters.search)
    conditions.push(
      Prisma.sql`(${nameContains("t", filters.search)} OR ${contains(column("t", "code"), filters.search)})`,
    );
  addNumeric(conditions, filters, "sectionCount", sectionCount);
  return conditions;
}

function sectionQuery(filters: CatalogTableFilters) {
  const conditions: Prisma.Sql[] = [Prisma.sql`"s"."retiredAt" IS NULL`];
  for (const key of ["semesterId", "campusId"])
    addIds(conditions, filters, key, column("s", key));
  addIds(conditions, filters, "departmentId", column("s", "openDepartmentId"));
  for (const key of ["categoryId", "classTypeId", "educationLevelId"])
    addIds(conditions, filters, key, column("c", key));
  if (filters.courseName)
    conditions.push(nameContains("c", filters.courseName));
  for (const key of ["credits", "stdCount", "limitCount"])
    addNumeric(conditions, filters, key, column("s", key));
  addNumeric(conditions, filters, "teacherCount", teacherCount);

  // Explicit controls retain precedence over the same advanced-search tag.
  const parsed = parseSectionSearchQuery(filters.search ?? "");
  const teacher = filters.teacher ?? parsed.teacher;
  const courseCode = filters.courseCode ?? parsed.courseCode;
  const sectionCode = filters.sectionCode ?? parsed.lectureCode;
  if (teacher) conditions.push(teacherContains(teacher));
  if (courseCode) conditions.push(contains(column("c", "code"), courseCode));
  if (sectionCode) conditions.push(contains(column("s", "code"), sectionCode));
  if (
    filters.credits === undefined &&
    parsed.credits &&
    Number.isFinite(Number(parsed.credits))
  ) {
    conditions.push(Prisma.sql`"s"."credits" = ${Number(parsed.credits)}`);
  }
  for (const [key, alias] of [
    ["campus", "p"],
    ["department", "d"],
    ["category", "g"],
    ["level", "e"],
    ["classType", "l"],
  ] as const) {
    if (parsed[key]) conditions.push(nameContains(alias, parsed[key]));
  }
  if (parsed.semester)
    conditions.push(contains(column("m", "nameCn"), parsed.semester));
  if (parsed.general) {
    for (const term of searchTerms(parsed.general)) {
      conditions.push(
        Prisma.sql`(${nameContains("c", term)} OR ${contains(column("c", "code"), term)} OR ${contains(column("s", "code"), term)} OR ${teacherContains(term)})`,
      );
    }
  }
  const sorts: Record<string, Prisma.Sql> = {
    credits: column("s", "credits"),
    credit: column("s", "credits"),
    capacity: column("s", "stdCount"),
    semester: column("m", "jwId"),
    course: column("c", "nameCn"),
    coursename: column("c", "nameCn"),
    code: column("s", "code"),
    sectioncode: column("s", "code"),
    teacher: teacherCount,
    campus: column("p", "nameCn"),
  };
  const sort = sorts[(filters.sort ?? parsed.sort ?? "").toLowerCase()];
  const direction =
    (filters.order ?? parsed.order) === "desc"
      ? Prisma.sql`DESC`
      : Prisma.sql`ASC`;
  const orderBy = sort
    ? Prisma.sql`${sort} ${direction}, "s"."jwId" ASC`
    : Prisma.sql`"m"."jwId" DESC, "s"."jwId" ASC`;
  return { conditions, orderBy };
}

/** Only static SQL identifiers/operators are interpolated; all form values are bound. */
export function buildCatalogTableQuery(
  kind: CatalogTableKind,
  input: CatalogTableFilters,
) {
  const params = new URLSearchParams(
    Object.entries(input).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  const filters = catalogTableFilterValues(
    `/catalog/${kind}` as CatalogListPath,
    params,
  );
  if (kind === "courses")
    return {
      id: column("c", "id"),
      from: Prisma.sql`"Course" AS "c"`,
      where: conjunction(courseConditions(filters)),
      orderBy: Prisma.sql`"c"."code" ASC, "c"."jwId" ASC`,
      filters,
    };
  if (kind === "teachers")
    return {
      id: column("t", "id"),
      from: Prisma.sql`"Teacher" AS "t"`,
      where: conjunction(teacherConditions(filters)),
      orderBy: Prisma.sql`"t"."nameCn" ASC, "t"."jwId" ASC`,
      filters,
    };
  const { conditions, orderBy } = sectionQuery(filters);
  return {
    id: column("s", "id"),
    from: Prisma.sql`"Section" AS "s"
      JOIN "Course" AS "c" ON "c"."id" = "s"."courseId"
      LEFT JOIN "Semester" AS "m" ON "m"."id" = "s"."semesterId"
      LEFT JOIN "Campus" AS "p" ON "p"."id" = "s"."campusId"
      LEFT JOIN "Department" AS "d" ON "d"."id" = "s"."openDepartmentId"
      LEFT JOIN "CourseCategory" AS "g" ON "g"."id" = "c"."categoryId"
      LEFT JOIN "EducationLevel" AS "e" ON "e"."id" = "c"."educationLevelId"
      LEFT JOIN "ClassType" AS "l" ON "l"."id" = "c"."classTypeId"`,
    where: conjunction(conditions),
    orderBy,
    filters,
  };
}

function conjunction(conditions: Prisma.Sql[]) {
  return conditions.length
    ? Prisma.join(
        conditions.map((condition) => Prisma.sql`(${condition})`),
        " AND ",
      )
    : Prisma.sql`TRUE`;
}
