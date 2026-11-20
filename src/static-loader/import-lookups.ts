/** Static-import upserts for semesters, departments, and catalog lookup tables. */
import type { Prisma } from "../generated/prisma-node/client";
import type { loadCatalogLookups } from "./catalog-plan";
import { bulkUpsert } from "./database-writes";
import type {
  CourseBuild,
  DepartmentBuild,
  DepartmentPlaceholderRequest,
  SemesterBuild,
} from "./mappers";

export async function upsertSemesters(
  tx: Prisma.TransactionClient,
  builds: SemesterBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "Semester",
    "jwId",
    "int",
    ["nameCn", "code", "startDate", "endDate"],
    ["text", "text", "date", "date"],
    builds.map((build) => ({
      key: build.jwId,
      values: [build.nameCn, build.code, build.start, build.end],
    })),
  );
}

export async function upsertDepartments(
  tx: Prisma.TransactionClient,
  builds: DepartmentBuild[],
  placeholders: DepartmentPlaceholderRequest[],
): Promise<Map<string, number>> {
  const jwIdToId = new Map<number, number>();
  for (const build of builds) {
    const result = await tx.department.upsert({
      where: { jwId: build.jwId },
      create: {
        jwId: build.jwId,
        code: build.code,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        isCollege: build.isCollege,
      },
      update: {
        code: build.code,
        nameCn: build.nameCn,
        nameEn: build.nameEn,
        isCollege: build.isCollege,
      },
    });
    jwIdToId.set(build.jwId, result.id);
  }
  const map = new Map<string, number>();
  for (const build of builds) {
    const id = jwIdToId.get(build.jwId);
    if (id != null) map.set(build.code, id);
  }
  for (const placeholder of placeholders) {
    const existing = await tx.department.findFirst({
      where: { code: placeholder.code, jwId: null },
      select: { id: true },
    });
    const id =
      existing?.id ??
      (
        await tx.department.create({
          data: {
            jwId: null,
            code: placeholder.code,
            nameCn: placeholder.nameCn,
            isCollege: false,
          },
          select: { id: true },
        })
      ).id;
    map.set(placeholder.code, id);
  }
  return map;
}

export type LookupMaps = {
  courseCategory: Map<string, number>;
  courseClassify: Map<string, number>;
  courseGradation: Map<string, number>;
  courseType: Map<string, number>;
  educationLevel: Map<string, number>;
  classType: Map<string, number>;
  examMode: Map<string, number>;
  teachLanguage: Map<string, number>;
};

type LookupName = { nameCn: string; nameEn?: string };

export async function loadLookupTables(
  tx: Prisma.TransactionClient,
  lookups: ReturnType<typeof loadCatalogLookups>,
  officialCourses: CourseBuild[],
): Promise<LookupMaps> {
  async function loadModel(
    table: Capitalize<keyof LookupMaps>,
    items: LookupName[],
    field?: "categoryName" | "classifyName" | "typeName",
  ) {
    const upsert = (names: LookupName[], ignoreConflicts = false) =>
      bulkUpsert(
        tx,
        table,
        "nameCn",
        "text",
        ["nameEn"],
        ["text"],
        names.map((item) => ({ key: item.nameCn, values: [item.nameEn] })),
        { ignoreConflicts },
      );
    const ids = await upsert(items);
    if (!field) return ids;
    const names = new Set(
      officialCourses.flatMap((course) => course[field] ?? []),
    );
    const missing = [...names].filter((name) => !ids.has(name));
    const added = await upsert(
      missing.map((nameCn) => ({ nameCn })),
      true,
    );
    return new Map([...ids, ...added]);
  }

  return {
    courseCategory: await loadModel(
      "CourseCategory",
      lookups.courseCategories,
      "categoryName",
    ),
    courseClassify: await loadModel(
      "CourseClassify",
      lookups.courseClassifies,
      "classifyName",
    ),
    courseGradation: await loadModel(
      "CourseGradation",
      lookups.courseGradations,
    ),
    courseType: await loadModel("CourseType", lookups.courseTypes, "typeName"),
    educationLevel: await loadModel("EducationLevel", lookups.educationLevels),
    classType: await loadModel("ClassType", lookups.classTypes),
    examMode: await loadModel("ExamMode", lookups.examModes),
    teachLanguage: await loadModel("TeachLanguage", lookups.teachLanguages),
  };
}
