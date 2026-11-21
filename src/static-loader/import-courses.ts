/** Static-import upserts for courses, teachers, titles, lesson types, and exam batches. */
import type { Prisma } from "../generated/prisma-node/client";
import { bulkUpsert } from "./database-writes";
import type { LookupMaps } from "./import-lookups";
import type {
  CourseBuild,
  ExamBatchBuild,
  TeacherBuild,
  TeacherLessonTypeBuild,
  TeacherTitleBuild,
} from "./mappers";
import { optionalId } from "./required-id";

export async function upsertCourses(
  tx: Prisma.TransactionClient,
  builds: CourseBuild[],
  lookupMaps: LookupMaps,
  source: "semester" | "officialCatalog" = "semester",
): Promise<Map<number, number>> {
  const officialCatalogOnly = source === "officialCatalog";
  const references = [
    ["categoryId", "courseCategory", "categoryName"],
    ["classTypeId", "classType", "classTypeName"],
    ["classifyId", "courseClassify", "classifyName"],
    ["educationLevelId", "educationLevel", "educationLevelName"],
    ["gradationId", "courseGradation", "gradationName"],
    ["typeId", "courseType", "typeName"],
  ] as const;
  const records = builds.map((build) => ({
    key: build.jwId,
    values: [
      build.code,
      build.nameCn,
      build.nameEn,
      ...references.map(([, lookup, field]) =>
        optionalId(
          lookupMaps[lookup],
          build[field],
          `${lookup} ${build[field]} for Course jwId ${build.jwId}`,
        ),
      ),
      officialCatalogOnly,
    ],
  }));
  return bulkUpsert(
    tx,
    "Course",
    "jwId",
    "int",
    [
      "code",
      "nameCn",
      "nameEn",
      ...references.map(([column]) => column),
      "officialCatalogOnly",
    ],
    ["text", "text", "text", ...references.map(() => "int"), "boolean"],
    records,
    { updateWhenTrue: officialCatalogOnly ? "officialCatalogOnly" : undefined },
  );
}

export async function upsertTeacherTitles(
  tx: Prisma.TransactionClient,
  builds: TeacherTitleBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "TeacherTitle",
    "jwId",
    "int",
    ["nameCn", "nameEn", "code", "enabled"],
    ["text", "text", "text", "boolean"],
    builds.map((build) => ({
      key: build.jwId,
      values: [build.nameCn, build.nameEn, build.code, build.enabled],
    })),
  );
}

export async function upsertTeacherLessonTypes(
  tx: Prisma.TransactionClient,
  builds: TeacherLessonTypeBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "TeacherLessonType",
    "jwId",
    "int",
    ["nameCn", "nameEn", "code", "role", "enabled"],
    ["text", "text", "text", "text", "boolean"],
    builds.map((build) => ({
      key: build.jwId,
      values: [
        build.nameCn,
        build.nameEn,
        build.code,
        build.role,
        build.enabled,
      ],
    })),
  );
}

export async function upsertExamBatches(
  tx: Prisma.TransactionClient,
  builds: ExamBatchBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "ExamBatch",
    "jwId",
    "int",
    ["nameCn"],
    ["text"],
    builds.map((build) => ({ key: build.jwId, values: [build.nameCn] })),
  );
}

export async function upsertTeachers(
  tx: Prisma.TransactionClient,
  builds: TeacherBuild[],
  departmentMap: Map<string, number>,
): Promise<TeacherMap> {
  const columns = [
    "personId",
    "code",
    "nameCn",
    "nameEn",
    "age",
    "email",
    "telephone",
    "mobile",
    "address",
    "postcode",
    "qq",
    "wechat",
    "departmentId",
  ] as const;

  const resolved = builds.map((build) => {
    const departmentId = build.departmentCode
      ? departmentMap.get(build.departmentCode)
      : undefined;
    return {
      build,
      departmentId,
      key: build.jwId,
      values: columns.map((column) =>
        column === "departmentId" ? departmentId : build[column],
      ),
    };
  });
  const unresolvedTeacherDepartmentCodes = new Set(
    resolved
      .filter(
        ({ build, departmentId }) =>
          build.departmentCode && departmentId == null,
      )
      .map(({ build }) => build.departmentCode as string),
  );
  if (unresolvedTeacherDepartmentCodes.size > 0) {
    throw new Error(
      `Teacher department codes have no authoritative upstream Department id: ${[...unresolvedTeacherDepartmentCodes].sort().join(", ")}`,
    );
  }
  return bulkUpsert(
    tx,
    "Teacher",
    "jwId",
    "int",
    [...columns],
    [
      "int",
      "text",
      "text",
      "text",
      "int",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "text",
      "int",
    ],
    resolved,
  );
}

export type TeacherMap = Map<number, number>;
