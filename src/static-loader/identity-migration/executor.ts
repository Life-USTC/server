import { LEGACY_STATIC_IDENTITY_INDEXES } from "../identity-migration-state";
import type { IdentityMigrationSql } from "./database-reader";
import type {
  DatabaseState,
  EdgeMapping,
  EntityMapping,
  IdentityMigrationPlan,
  SnapshotEntity,
  SnapshotState,
} from "./types";

export type IdentityMigrationApplyReport = {
  createdTargets: number;
  rebuiltEdges: number;
  deletedLegacyRows: number;
};

type TargetIds = Map<EntityMapping["entity"], Map<number, number>>;

export async function applyIdentityMigrationPlan(
  tx: IdentityMigrationSql,
  plan: IdentityMigrationPlan,
  snapshot: SnapshotState,
  database: DatabaseState,
): Promise<IdentityMigrationApplyReport> {
  if (plan.mode !== "plan" || plan.blockers.length > 0) {
    throw new Error("Refusing to apply an incomplete or blocked identity plan");
  }

  await lockAffectedRows(tx);
  const titleEdges = plan.edgeMappings.filter(
    (edge) => edge.entity === "teacherAssignmentTitle",
  );
  if (titleEdges.length > 0 && !(await hasAssignmentTitleColumn(tx))) {
    throw new Error(
      "TeacherAssignment title schema is not installed; refusing to guess legacy Teacher titles",
    );
  }

  for (const index of LEGACY_STATIC_IDENTITY_INDEXES) {
    await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS "${index}"`);
  }

  let createdTargets = 0;
  for (const mapping of plan.entityMappings) {
    createdTargets += await ensureEntityTargets(tx, mapping, snapshot);
  }
  const targetIds = await readTargetIds(tx, plan.entityMappings);
  const rebuiltEdges = await rebuildEdges(tx, plan.edgeMappings, targetIds);

  await migrateComments(tx, plan.entityMappings, targetIds);
  await migrateDescriptions(tx, plan.entityMappings, targetIds, database);
  await tx.$executeRawUnsafe(
    `DELETE FROM "CourseAlias" WHERE "courseId" = ANY($1::int[])`,
    database.courses.map((row) => row.id),
  );
  const deletedLegacyRows = await deleteLegacyRows(
    tx,
    plan.entityMappings,
    targetIds,
  );

  await tx.$executeRawUnsafe(
    `INSERT INTO "StaticIdentityMigrationState" ("id", "snapshotSha256", "completedAt")
     VALUES ('raw-jwid-v1', $1, CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE SET
       "snapshotSha256" = EXCLUDED."snapshotSha256",
       "completedAt" = EXCLUDED."completedAt"`,
    plan.snapshotSha256,
  );
  return { createdTargets, rebuiltEdges, deletedLegacyRows };
}

async function lockAffectedRows(tx: IdentityMigrationSql) {
  for (const table of [
    "Course",
    "AdminClass",
    "TeacherTitle",
    "ExamBatch",
    "Department",
    "Campus",
    "Building",
    "Teacher",
    "Section",
    "Exam",
    "SectionTeacher",
    "TeacherAssignment",
    "Description",
    "Comment",
  ]) {
    await tx.$queryRawUnsafe(
      `SELECT "id" FROM "${table}" ORDER BY "id" FOR UPDATE`,
    );
  }
}

async function hasAssignmentTitleColumn(tx: IdentityMigrationSql) {
  const rows = await tx.$queryRawUnsafe<Array<{ present: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'TeacherAssignment'
         AND column_name = 'teacherTitleId'
     ) AS "present"`,
  );
  return rows[0]?.present === true;
}

async function ensureEntityTargets(
  tx: IdentityMigrationSql,
  mapping: EntityMapping,
  snapshot: SnapshotState,
) {
  let created = 0;
  for (const targetJwId of mapping.targetJwIds) {
    const source = sourceEntity(snapshot, mapping.entity, targetJwId);
    if (source == null) {
      throw new Error(
        `${mapping.entity} target ${targetJwId} is absent from the fixed snapshot`,
      );
    }
    created += await insertTarget(tx, mapping.entity, mapping.legacyId, source);
  }
  return created;
}

async function insertTarget(
  tx: IdentityMigrationSql,
  entity: EntityMapping["entity"],
  legacyId: number,
  source: SnapshotEntity,
) {
  switch (entity) {
    case "course":
      return tx.$executeRawUnsafe(
        `INSERT INTO "Course" ("jwId", "code", "nameCn", "nameEn", "categoryId", "classTypeId", "classifyId", "educationLevelId", "gradationId", "typeId")
         SELECT $2, $3, $4, c."nameEn", c."categoryId", c."classTypeId", c."classifyId", c."educationLevelId", c."gradationId", c."typeId"
         FROM "Course" c WHERE c."id" = $1
         ON CONFLICT ("jwId") DO NOTHING`,
        legacyId,
        source.jwId,
        source.code ?? "",
        source.nameCn,
      );
    case "adminClass":
      return cloneJwIdEntity(
        tx,
        "AdminClass",
        legacyId,
        source,
        `"code", "grade", "nameCn", "nameEn", "stdCount", "planCount", "enabled", "abbrZh", "abbrEn"`,
        `$3, a."grade", $4, a."nameEn", a."stdCount", a."planCount", a."enabled", a."abbrZh", a."abbrEn"`,
      );
    case "teacherTitle":
      return cloneJwIdEntity(
        tx,
        "TeacherTitle",
        legacyId,
        source,
        `"nameCn", "nameEn", "code", "enabled"`,
        `$4, a."nameEn", $3, a."enabled"`,
      );
    case "examBatch":
      return cloneJwIdEntity(
        tx,
        "ExamBatch",
        legacyId,
        source,
        `"nameCn", "nameEn"`,
        `$4, a."nameEn"`,
      );
    case "department":
      return cloneJwIdEntity(
        tx,
        "Department",
        legacyId,
        source,
        `"code", "nameCn", "nameEn", "isCollege"`,
        `$3, $4, a."nameEn", a."isCollege"`,
      );
    case "campus":
      return cloneJwIdEntity(
        tx,
        "Campus",
        legacyId,
        source,
        `"nameCn", "nameEn", "code"`,
        `$4, a."nameEn", $3`,
      );
    case "teacher":
      return tx.$executeRawUnsafe(
        `INSERT INTO "Teacher" ("jwId", "personId", "teacherId", "code", "nameCn", "nameEn", "age", "email", "telephone", "mobile", "address", "postcode", "qq", "wechat", "departmentId", "teacherTitleId")
         SELECT $2, t."personId", NULL, $3, $4, t."nameEn", t."age", t."email", t."telephone", t."mobile", t."address", t."postcode", t."qq", t."wechat", t."departmentId", t."teacherTitleId"
         FROM "Teacher" t WHERE t."id" = $1
         ON CONFLICT ("jwId") DO NOTHING`,
        legacyId,
        source.jwId,
        source.code ?? null,
        source.nameCn,
      );
  }
}

function cloneJwIdEntity(
  tx: IdentityMigrationSql,
  table: string,
  legacyId: number,
  source: SnapshotEntity,
  columns: string,
  values: string,
) {
  return tx.$executeRawUnsafe(
    `INSERT INTO "${table}" ("jwId", ${columns})
     SELECT $2, ${values} FROM "${table}" a WHERE a."id" = $1
     ON CONFLICT ("jwId") DO NOTHING`,
    legacyId,
    source.jwId,
    source.code ?? null,
    source.nameCn,
  );
}

function sourceEntity(
  snapshot: SnapshotState,
  entity: EntityMapping["entity"],
  jwId: number,
) {
  const rows =
    entity === "course"
      ? snapshot.courses
      : entity === "adminClass"
        ? snapshot.adminClasses
        : entity === "teacherTitle"
          ? snapshot.teacherTitles
          : entity === "examBatch"
            ? snapshot.examBatches
            : entity === "department"
              ? snapshot.departments
              : entity === "campus"
                ? snapshot.campuses
                : snapshot.teachers;
  return rows.find((row) => row.jwId === jwId);
}

async function readTargetIds(
  tx: IdentityMigrationSql,
  mappings: readonly EntityMapping[],
): Promise<TargetIds> {
  const result = new Map<EntityMapping["entity"], Map<number, number>>();
  for (const entity of [
    "course",
    "adminClass",
    "teacherTitle",
    "examBatch",
    "department",
    "campus",
    "teacher",
  ] as const) {
    const targets = new Set(
      mappings
        .filter((mapping) => mapping.entity === entity)
        .flatMap((mapping) => mapping.targetJwIds),
    );
    if (targets.size === 0) {
      result.set(entity, new Map());
      continue;
    }
    const table = tableForEntity(entity);
    const identityColumn = "jwId";
    const rows = await tx.$queryRawUnsafe<Array<{ id: number; jwId: number }>>(
      `SELECT "id", "${identityColumn}" AS "jwId" FROM "${table}" WHERE "${identityColumn}" = ANY($1::int[])`,
      [...targets],
    );
    const ids = new Map(rows.map((row) => [row.jwId, row.id]));
    if (ids.size !== targets.size) {
      throw new Error(`${entity} target materialization was incomplete`);
    }
    result.set(entity, ids);
  }
  return result;
}

async function rebuildEdges(
  tx: IdentityMigrationSql,
  edges: readonly EdgeMapping[],
  targetIds: TargetIds,
) {
  let rebuilt = 0;
  for (const edge of edges.filter(
    (item) =>
      item.entity !== "sectionAdminClass" &&
      item.entity !== "implicitSectionTeacher" &&
      item.entity !== "scheduleTeacher",
  )) {
    const targetId = edgeTargetId(edge, targetIds);
    switch (edge.entity) {
      case "sectionCourse":
        rebuilt += await updateForeignKey(
          tx,
          "Section",
          edge.ownerId,
          "courseId",
          targetId,
        );
        break;
      case "examBatchEdge":
        rebuilt += await updateForeignKey(
          tx,
          "Exam",
          edge.ownerId,
          "examBatchId",
          targetId,
        );
        break;
      case "departmentEdge":
        if (edge.ownerType == null) {
          throw new Error("Department edge is missing its owner type");
        }
        rebuilt += await updateForeignKey(
          tx,
          edge.ownerType === "section" ? "Section" : "Teacher",
          edge.ownerId,
          edge.ownerType === "section" ? "openDepartmentId" : "departmentId",
          targetId,
        );
        break;
      case "buildingCampus":
        rebuilt += await updateForeignKey(
          tx,
          "Building",
          edge.ownerId,
          "campusId",
          targetId,
        );
        break;
      case "sectionCampus":
        rebuilt += await updateForeignKey(
          tx,
          "Section",
          edge.ownerId,
          "campusId",
          targetId,
        );
        break;
      case "sectionTeacher":
        rebuilt += await rebuildSectionTeacher(tx, edge.ownerId, targetId);
        break;
      case "teacherAssignmentTeacher":
        rebuilt += await updateForeignKey(
          tx,
          "TeacherAssignment",
          edge.ownerId,
          "teacherId",
          targetId,
        );
        break;
      case "teacherAssignmentTitle":
        rebuilt += await updateForeignKey(
          tx,
          "TeacherAssignment",
          edge.ownerId,
          "teacherTitleId",
          targetId,
        );
        break;
    }
  }
  rebuilt += await rebuildJoinEdges(
    tx,
    edges.filter((edge) => edge.entity === "implicitSectionTeacher"),
    "_SectionTeachers",
    "A",
    targetIds.get("teacher") ?? new Map(),
  );
  rebuilt += await rebuildJoinEdges(
    tx,
    edges.filter((edge) => edge.entity === "sectionAdminClass"),
    "_SectionAdminClasses",
    "B",
    targetIds.get("adminClass") ?? new Map(),
  );
  rebuilt += await rebuildJoinEdges(
    tx,
    edges.filter((edge) => edge.entity === "scheduleTeacher"),
    "_ScheduleTeachers",
    "A",
    targetIds.get("teacher") ?? new Map(),
  );
  return rebuilt;
}

function edgeTargetId(edge: EdgeMapping, targets: TargetIds) {
  const entity =
    edge.entity === "sectionCourse"
      ? "course"
      : edge.entity === "sectionAdminClass"
        ? "adminClass"
        : edge.entity === "examBatchEdge"
          ? "examBatch"
          : edge.entity === "departmentEdge"
            ? "department"
            : edge.entity === "buildingCampus" ||
                edge.entity === "sectionCampus"
              ? "campus"
              : edge.entity === "teacherAssignmentTitle"
                ? "teacherTitle"
                : "teacher";
  const id = targets.get(entity)?.get(edge.targetJwId);
  if (id == null) throw new Error(`${edge.entity} target did not materialize`);
  return id;
}

function updateForeignKey(
  tx: IdentityMigrationSql,
  table: string,
  ownerId: number,
  column: string,
  targetId: number,
) {
  return tx.$executeRawUnsafe(
    `UPDATE "${table}" SET "${column}" = $2 WHERE "id" = $1`,
    ownerId,
    targetId,
  );
}

async function rebuildSectionTeacher(
  tx: IdentityMigrationSql,
  legacyRelationId: number,
  targetTeacherId: number,
) {
  const rows = await tx.$queryRawUnsafe<
    Array<{ sectionId: number; targetRelationId: number }>
  >(
    `WITH source AS (
       SELECT "sectionId" FROM "SectionTeacher" WHERE "id" = $1
     ), inserted AS (
       INSERT INTO "SectionTeacher" ("sectionId", "teacherId", "createdAt", "updatedAt", "retiredAt")
       SELECT "sectionId", $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL FROM source
       ON CONFLICT ("sectionId", "teacherId") DO UPDATE SET "retiredAt" = NULL
       RETURNING "id", "sectionId"
     )
     SELECT "sectionId", "id" AS "targetRelationId" FROM inserted`,
    legacyRelationId,
    targetTeacherId,
  );
  const target = rows[0];
  if (target == null)
    throw new Error(`SectionTeacher ${legacyRelationId} is missing`);
  await tx.$executeRawUnsafe(
    `UPDATE "Comment" SET "sectionTeacherId" = $2 WHERE "sectionTeacherId" = $1`,
    legacyRelationId,
    target.targetRelationId,
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO "_SectionTeachers" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    target.sectionId,
    targetTeacherId,
  );
  return 1;
}

async function rebuildJoinEdges(
  tx: IdentityMigrationSql,
  edges: readonly EdgeMapping[],
  table: string,
  ownerColumn: "A" | "B",
  targets: Map<number, number>,
) {
  const byOwner = new Map<number, EdgeMapping[]>();
  for (const edge of edges) {
    const group = byOwner.get(edge.ownerId) ?? [];
    group.push(edge);
    byOwner.set(edge.ownerId, group);
  }
  let count = 0;
  for (const [ownerId, ownerEdges] of byOwner) {
    await tx.$executeRawUnsafe(
      `DELETE FROM "${table}" WHERE "${ownerColumn}" = $1`,
      ownerId,
    );
    for (const edge of ownerEdges) {
      const targetId = targets.get(edge.targetJwId);
      if (targetId == null) throw new Error(`${edge.entity} target is missing`);
      const a = ownerColumn === "A" ? ownerId : targetId;
      const b = ownerColumn === "A" ? targetId : ownerId;
      count += await tx.$executeRawUnsafe(
        `INSERT INTO "${table}" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        a,
        b,
      );
    }
  }
  return count;
}

async function migrateComments(
  tx: IdentityMigrationSql,
  mappings: readonly EntityMapping[],
  targets: TargetIds,
) {
  for (const entity of ["course", "teacher"] as const) {
    const column = entity === "course" ? "courseId" : "teacherId";
    for (const mapping of mappings.filter((item) => item.entity === entity)) {
      if (mapping.targetJwIds.length !== 1) continue;
      const targetId = targets.get(entity)?.get(mapping.targetJwIds[0]);
      if (targetId == null || targetId === mapping.legacyId) continue;
      await tx.$executeRawUnsafe(
        `UPDATE "Comment" SET "${column}" = $2 WHERE "${column}" = $1`,
        mapping.legacyId,
        targetId,
      );
    }
  }
}

async function migrateDescriptions(
  tx: IdentityMigrationSql,
  mappings: readonly EntityMapping[],
  targets: TargetIds,
  database: DatabaseState,
) {
  for (const entity of ["course", "teacher"] as const) {
    const column = entity === "course" ? "courseId" : "teacherId";
    const sourceRows =
      entity === "course" ? database.courses : database.teachers;
    const descriptionsWithUserContent = new Set<string>();
    for (const row of sourceRows) {
      if (
        row.description != null &&
        row.description.contentFingerprint !== ""
      ) {
        descriptionsWithUserContent.add(row.description.id);
      }
    }
    const descriptionsByTarget = new Map<number, string[]>();
    for (const mapping of mappings.filter((item) => item.entity === entity)) {
      for (const targetJwId of mapping.targetJwIds) {
        const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT "id" FROM "Description" WHERE "${column}" = $1`,
          mapping.legacyId,
        );
        if (rows[0] == null || !descriptionsWithUserContent.has(rows[0].id)) {
          continue;
        }
        const ids = descriptionsByTarget.get(targetJwId) ?? [];
        ids.push(rows[0].id);
        descriptionsByTarget.set(targetJwId, ids);
      }
    }
    for (const [targetJwId, ids] of descriptionsByTarget) {
      const uniqueIds = [...new Set(ids)].sort((a, b) => a.localeCompare(b));
      const canonical = uniqueIds[0];
      const targetId = targets.get(entity)?.get(targetJwId);
      if (canonical == null || targetId == null) continue;
      for (const duplicate of uniqueIds.slice(1)) {
        await tx.$executeRawUnsafe(
          `UPDATE "DescriptionEdit" SET "descriptionId" = $2 WHERE "descriptionId" = $1`,
          duplicate,
          canonical,
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM "Description" WHERE "id" = $1`,
          duplicate,
        );
      }
      await tx.$executeRawUnsafe(
        `UPDATE "Description" SET "${column}" = $2 WHERE "id" = $1`,
        canonical,
        targetId,
      );
    }
  }
}

async function deleteLegacyRows(
  tx: IdentityMigrationSql,
  mappings: readonly EntityMapping[],
  targets: TargetIds,
) {
  let deleted = 0;
  for (const entity of [
    "course",
    "adminClass",
    "examBatch",
    "department",
    "campus",
    "teacher",
    "teacherTitle",
  ] as const) {
    for (const mapping of mappings.filter((item) => item.entity === entity)) {
      if (mapping.targetJwIds.length === 0) continue;
      const targetDatabaseIds = new Set(
        mapping.targetJwIds
          .map((jwId) => targets.get(entity)?.get(jwId))
          .filter((id): id is number => id != null),
      );
      if (targetDatabaseIds.has(mapping.legacyId)) continue;
      if (entity === "teacherTitle") {
        await tx.$executeRawUnsafe(
          `UPDATE "Teacher" SET "teacherTitleId" = NULL WHERE "teacherTitleId" = $1`,
          mapping.legacyId,
        );
      }
      deleted += await tx.$executeRawUnsafe(
        `DELETE FROM "${tableForEntity(entity)}" WHERE "id" = $1`,
        mapping.legacyId,
      );
    }
  }
  await tx.$executeRawUnsafe(
    `DELETE FROM "SectionTeacher" st
     WHERE NOT EXISTS (
       SELECT 1 FROM "_SectionTeachers" j
       WHERE j."A" = st."sectionId" AND j."B" = st."teacherId"
     ) AND NOT EXISTS (
       SELECT 1 FROM "Comment" c WHERE c."sectionTeacherId" = st."id"
     )`,
  );
  return deleted;
}

function tableForEntity(entity: EntityMapping["entity"]) {
  return {
    course: "Course",
    adminClass: "AdminClass",
    teacherTitle: "TeacherTitle",
    examBatch: "ExamBatch",
    department: "Department",
    campus: "Campus",
    teacher: "Teacher",
  }[entity];
}
