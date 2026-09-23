/** Static-import upserts for semesters, departments, and catalog lookup tables. */
import type { Prisma } from "../generated/prisma-node/client";
import { bulkUpsert } from "./database-writes";
import type {
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

export async function loadLookupTables(
  tx: Prisma.TransactionClient,
  lookups: {
    courseCategories: { nameCn: string; nameEn?: string }[];
    courseClassifies: { nameCn: string; nameEn?: string }[];
    courseGradations: { nameCn: string; nameEn?: string }[];
    courseTypes: { nameCn: string; nameEn?: string }[];
    educationLevels: { nameCn: string; nameEn?: string }[];
    classTypes: { nameCn: string; nameEn?: string }[];
    examModes: { nameCn: string; nameEn?: string }[];
    teachLanguages: { nameCn: string; nameEn?: string }[];
  },
): Promise<LookupMaps> {
  async function loadModel(
    table:
      | "CourseCategory"
      | "CourseClassify"
      | "CourseGradation"
      | "CourseType"
      | "EducationLevel"
      | "ClassType"
      | "ExamMode"
      | "TeachLanguage",
    items: { nameCn: string; nameEn?: string }[],
  ) {
    return bulkUpsert(
      tx,
      table,
      "nameCn",
      "text",
      ["nameEn"],
      ["text"],
      items.map((item) => ({ key: item.nameCn, values: [item.nameEn] })),
    );
  }

  return {
    courseCategory: await loadModel("CourseCategory", lookups.courseCategories),
    courseClassify: await loadModel("CourseClassify", lookups.courseClassifies),
    courseGradation: await loadModel(
      "CourseGradation",
      lookups.courseGradations,
    ),
    courseType: await loadModel("CourseType", lookups.courseTypes),
    educationLevel: await loadModel("EducationLevel", lookups.educationLevels),
    classType: await loadModel("ClassType", lookups.classTypes),
    examMode: await loadModel("ExamMode", lookups.examModes),
    teachLanguage: await loadModel("TeachLanguage", lookups.teachLanguages),
  };
}
