/** Static-import upserts for courses, teachers, titles, lesson types, and exam batches. */
import type { Prisma } from "../generated/prisma-node/client";
import { bulkUpsert, type ColumnValue } from "./database-writes";
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
): Promise<Map<number, number>> {
  const columns = [
    "code",
    "nameCn",
    "nameEn",
    "categoryId",
    "classTypeId",
    "classifyId",
    "educationLevelId",
    "gradationId",
    "typeId",
  ];
  const records = builds.map((build) => ({
    key: build.jwId,
    values: [
      build.code,
      build.nameCn,
      build.nameEn,
      optionalId(
        lookupMaps.courseCategory,
        build.categoryName,
        `CourseCategory ${build.categoryName} for Course jwId ${build.jwId}`,
      ),
      optionalId(
        lookupMaps.classType,
        build.classTypeName,
        `ClassType ${build.classTypeName} for Course jwId ${build.jwId}`,
      ),
      optionalId(
        lookupMaps.courseClassify,
        build.classifyName,
        `CourseClassify ${build.classifyName} for Course jwId ${build.jwId}`,
      ),
      optionalId(
        lookupMaps.educationLevel,
        build.educationLevelName,
        `EducationLevel ${build.educationLevelName} for Course jwId ${build.jwId}`,
      ),
      optionalId(
        lookupMaps.courseGradation,
        build.gradationName,
        `CourseGradation ${build.gradationName} for Course jwId ${build.jwId}`,
      ),
      optionalId(
        lookupMaps.courseType,
        build.typeName,
        `CourseType ${build.typeName} for Course jwId ${build.jwId}`,
      ),
    ] satisfies ColumnValue[],
  }));
  return bulkUpsert(
    tx,
    "Course",
    "jwId",
    "int",
    columns,
    ["text", "text", "text", "int", "int", "int", "int", "int", "int"],
    records,
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
  ];

  const resolved = builds.map((build) => {
    const departmentId = build.departmentCode
      ? departmentMap.get(build.departmentCode)
      : undefined;
    return {
      build,
      departmentId,
      key: build.jwId,
      values: [
        build.personId ?? null,
        build.code ?? null,
        build.nameCn,
        build.nameEn ?? null,
        build.age ?? null,
        build.email ?? null,
        build.telephone ?? null,
        build.mobile ?? null,
        build.address ?? null,
        build.postcode ?? null,
        build.qq ?? null,
        build.wechat ?? null,
        departmentId ?? null,
      ] satisfies ColumnValue[],
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
    columns,
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
