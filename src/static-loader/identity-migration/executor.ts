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
  if (!(await hasAssignmentTitleColumn(tx))) {
    throw new Error(
      "TeacherAssignment title schema is not installed; refusing to guess legacy Teacher titles",
    );
  }

  for (const index of LEGACY_STATIC_IDENTITY_INDEXES) {
    await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS "${index}"`);
  }

  const createdTargets = await ensureEntityTargets(
    tx,
    plan.entityMappings,
    snapshot,
  );
  const targetIds = await readTargetIds(tx, plan.entityMappings);
  const rebuiltEdges = await rebuildEdges(tx, plan.edgeMappings, targetIds);
  await deleteUnmappedTeacherAssignments(
    tx,
    database.teacherAssignments,
    plan.edgeMappings,
  );

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
  await tx.$executeRawUnsafe(
    `LOCK TABLE "Course", "AdminClass", "TeacherTitle", "ExamBatch",
       "Department", "Campus", "Building", "Teacher", "Section", "Exam",
       "SectionTeacher", "TeacherAssignment", "Description", "DescriptionEdit",
       "Comment", "CourseAlias", "_SectionTeachers", "_SectionAdminClasses",
       "_ScheduleTeachers", "StaticIdentityMigrationState"
     IN SHARE ROW EXCLUSIVE MODE`,
  );
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
  mappings: readonly EntityMapping[],
  snapshot: SnapshotState,
) {
  let created = 0;
  const recovered: Array<{ legacyId: number; targetJwId: number }> = [];
  const historical = new Map<
    EntityMapping["entity"],
    Array<{ legacyId: number; targetJwId: number }>
  >();
  const targets = new Map<
    EntityMapping["entity"],
    Array<{ legacyId: number; source: SnapshotEntity }>
  >();
  const seen = new Map<EntityMapping["entity"], Set<number>>();
  const snapshotByEntity = snapshotEntitiesByJwId(snapshot);

  for (const mapping of mappings) {
    for (const targetJwId of mapping.targetJwIds) {
      const source = snapshotByEntity.get(mapping.entity)?.get(targetJwId);
      if (source == null) {
        if (mapping.provenance.includes("historical")) {
          const entityRows = historical.get(mapping.entity) ?? [];
          entityRows.push({ legacyId: mapping.legacyId, targetJwId });
          historical.set(mapping.entity, entityRows);
          continue;
        }
        if (
          mapping.entity === "course" &&
          mapping.provenance.includes("recovered") &&
          mapping.targetJwIds.length === 1
        ) {
          recovered.push({ legacyId: mapping.legacyId, targetJwId });
          continue;
        }
        throw new Error(
          `${mapping.entity} target ${targetJwId} is absent from the fixed snapshot`,
        );
      }
      const entitySeen = seen.get(mapping.entity) ?? new Set<number>();
      if (entitySeen.has(targetJwId)) continue;
      entitySeen.add(targetJwId);
      seen.set(mapping.entity, entitySeen);
      const entityTargets = targets.get(mapping.entity) ?? [];
      entityTargets.push({ legacyId: mapping.legacyId, source });
      targets.set(mapping.entity, entityTargets);
    }
  }

  if (recovered.length > 0) {
    await tx.$executeRawUnsafe(
      `WITH input("legacyId", "targetJwId") AS (
         SELECT * FROM UNNEST($1::int[], $2::int[])
       )
       UPDATE "Course" source SET "jwId" = input."targetJwId"
       FROM input
       WHERE source."id" = input."legacyId"
         AND NOT EXISTS (
           SELECT 1 FROM "Course" target
           WHERE target."jwId" = input."targetJwId"
         )`,
      recovered.map((item) => item.legacyId),
      recovered.map((item) => item.targetJwId),
    );
  }
  for (const [entity, entityRows] of historical) {
    await tx.$executeRawUnsafe(
      `WITH input("legacyId", "targetJwId") AS (
         SELECT * FROM UNNEST($1::int[], $2::int[])
       )
       UPDATE "${tableForEntity(entity)}" source
       SET "jwId" = input."targetJwId"
       FROM input
       WHERE source."id" = input."legacyId"
         AND source."jwId" IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM "${tableForEntity(entity)}" target
           WHERE target."jwId" = input."targetJwId"
         )`,
      entityRows.map((item) => item.legacyId),
      entityRows.map((item) => item.targetJwId),
    );
  }
  for (const [entity, entityTargets] of targets) {
    created += await insertTargets(tx, entity, entityTargets);
  }
  return created;
}

async function insertTargets(
  tx: IdentityMigrationSql,
  entity: EntityMapping["entity"],
  targets: readonly { legacyId: number; source: SnapshotEntity }[],
) {
  const legacyIds = targets.map((target) => target.legacyId);
  const jwIds = targets.map((target) => target.source.jwId);
  const codes = targets.map((target) => target.source.code ?? null);
  const names = targets.map((target) => target.source.nameCn);
  const input = `UNNEST($1::int[], $2::int[], $3::text[], $4::text[])
                 AS input("legacyId", "jwId", "code", "nameCn")`;
  switch (entity) {
    case "course":
      return tx.$executeRawUnsafe(
        `INSERT INTO "Course" ("jwId", "code", "nameCn", "nameEn", "categoryId", "classTypeId", "classifyId", "educationLevelId", "gradationId", "typeId")
         SELECT input."jwId", COALESCE(input."code", ''), input."nameCn", c."nameEn", c."categoryId", c."classTypeId", c."classifyId", c."educationLevelId", c."gradationId", c."typeId"
         FROM ${input} JOIN "Course" c ON c."id" = input."legacyId"
         ON CONFLICT ("jwId") DO NOTHING`,
        legacyIds,
        jwIds,
        codes,
        names,
      );
    case "adminClass":
      return cloneJwIdEntities(
        tx,
        "AdminClass",
        targets,
        `"code", "grade", "nameCn", "nameEn", "stdCount", "planCount", "enabled", "abbrZh", "abbrEn"`,
        `input."code", a."grade", input."nameCn", a."nameEn", a."stdCount", a."planCount", a."enabled", a."abbrZh", a."abbrEn"`,
      );
    case "teacherTitle":
      return cloneJwIdEntities(
        tx,
        "TeacherTitle",
        targets,
        `"nameCn", "nameEn", "code", "enabled"`,
        `input."nameCn", a."nameEn", input."code", a."enabled"`,
      );
    case "examBatch":
      return cloneJwIdEntities(
        tx,
        "ExamBatch",
        targets,
        `"nameCn", "nameEn"`,
        `input."nameCn", a."nameEn"`,
      );
    case "department":
      return cloneJwIdEntities(
        tx,
        "Department",
        targets,
        `"code", "nameCn", "nameEn", "isCollege"`,
        `input."code", input."nameCn", a."nameEn", a."isCollege"`,
      );
    case "campus":
      return cloneJwIdEntities(
        tx,
        "Campus",
        targets,
        `"nameCn", "nameEn", "code"`,
        `input."nameCn", a."nameEn", input."code"`,
      );
    case "teacher":
      return tx.$executeRawUnsafe(
        `INSERT INTO "Teacher" ("jwId", "personId", "teacherId", "code", "nameCn", "nameEn", "age", "email", "telephone", "mobile", "address", "postcode", "qq", "wechat", "departmentId", "teacherTitleId")
         SELECT input."jwId", t."personId", NULL, input."code", input."nameCn", t."nameEn", t."age", t."email", t."telephone", t."mobile", t."address", t."postcode", t."qq", t."wechat", t."departmentId", t."teacherTitleId"
         FROM ${input} JOIN "Teacher" t ON t."id" = input."legacyId"
         ON CONFLICT ("jwId") DO NOTHING`,
        legacyIds,
        jwIds,
        codes,
        names,
      );
  }
}

function cloneJwIdEntities(
  tx: IdentityMigrationSql,
  table: string,
  targets: readonly { legacyId: number; source: SnapshotEntity }[],
  columns: string,
  values: string,
) {
  return tx.$executeRawUnsafe(
    `INSERT INTO "${table}" ("jwId", ${columns})
     SELECT input."jwId", ${values}
     FROM UNNEST($1::int[], $2::int[], $3::text[], $4::text[])
       AS input("legacyId", "jwId", "code", "nameCn")
     JOIN "${table}" a ON a."id" = input."legacyId"
     ON CONFLICT ("jwId") DO NOTHING`,
    targets.map((target) => target.legacyId),
    targets.map((target) => target.source.jwId),
    targets.map((target) => target.source.code ?? null),
    targets.map((target) => target.source.nameCn),
  );
}

function snapshotEntitiesByJwId(snapshot: SnapshotState) {
  return new Map<EntityMapping["entity"], Map<number, SnapshotEntity>>([
    ["course", new Map(snapshot.courses.map((row) => [row.jwId, row]))],
    [
      "adminClass",
      new Map(snapshot.adminClasses.map((row) => [row.jwId, row])),
    ],
    [
      "teacherTitle",
      new Map(snapshot.teacherTitles.map((row) => [row.jwId, row])),
    ],
    ["examBatch", new Map(snapshot.examBatches.map((row) => [row.jwId, row]))],
    ["department", new Map(snapshot.departments.map((row) => [row.jwId, row]))],
    ["campus", new Map(snapshot.campuses.map((row) => [row.jwId, row]))],
    ["teacher", new Map(snapshot.teachers.map((row) => [row.jwId, row]))],
  ]);
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
  await tx.$executeRawUnsafe(`DELETE FROM "_SectionTeachers"`);
  await tx.$executeRawUnsafe(`DELETE FROM "_SectionAdminClasses"`);
  await tx.$executeRawUnsafe(`DELETE FROM "_ScheduleTeachers"`);
  await tx.$executeRawUnsafe(
    `UPDATE "TeacherAssignment" SET "teacherTitleId" = NULL WHERE "teacherTitleId" IS NOT NULL`,
  );
  rebuilt += await rebuildForeignKeyEdges(
    tx,
    edges,
    targetIds,
    "sectionCourse",
    "Section",
    "courseId",
  );
  rebuilt += await rebuildForeignKeyEdges(
    tx,
    edges,
    targetIds,
    "examBatchEdge",
    "Exam",
    "examBatchId",
  );
  rebuilt += await rebuildForeignKeyEdges(
    tx,
    edges,
    targetIds,
    "buildingCampus",
    "Building",
    "campusId",
  );
  rebuilt += await rebuildForeignKeyEdges(
    tx,
    edges,
    targetIds,
    "sectionCampus",
    "Section",
    "campusId",
  );
  rebuilt += await rebuildForeignKeyEdges(
    tx,
    edges,
    targetIds,
    "teacherAssignmentTeacher",
    "TeacherAssignment",
    "teacherId",
  );
  rebuilt += await rebuildForeignKeyEdges(
    tx,
    edges,
    targetIds,
    "teacherAssignmentTitle",
    "TeacherAssignment",
    "teacherTitleId",
  );
  for (const ownerType of ["section", "teacher"] as const) {
    rebuilt += await rebuildForeignKeyEdges(
      tx,
      edges.filter((edge) => edge.ownerType === ownerType),
      targetIds,
      "departmentEdge",
      ownerType === "section" ? "Section" : "Teacher",
      ownerType === "section" ? "openDepartmentId" : "departmentId",
    );
  }
  rebuilt += await rebuildSectionTeachers(
    tx,
    edges.filter((edge) => edge.entity === "sectionTeacher"),
    targetIds,
  );
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

async function rebuildForeignKeyEdges(
  tx: IdentityMigrationSql,
  edges: readonly EdgeMapping[],
  targetIds: TargetIds,
  entity: EdgeMapping["entity"],
  table: string,
  column: string,
) {
  let rebuilt = 0;
  const matchingEdges = edges.filter((edge) => edge.entity === entity);
  if (matchingEdges.length === 0) return rebuilt;
  rebuilt += await tx.$executeRawUnsafe(
    `WITH input("ownerId", "targetId") AS (
       SELECT * FROM UNNEST($1::int[], $2::int[])
     )
     UPDATE "${table}" target SET "${column}" = input."targetId"
     FROM input WHERE target."id" = input."ownerId"`,
    matchingEdges.map((edge) => edge.ownerId),
    matchingEdges.map((edge) => edgeTargetId(edge, targetIds)),
  );
  return rebuilt;
}

async function rebuildSectionTeachers(
  tx: IdentityMigrationSql,
  edges: readonly EdgeMapping[],
  targetIds: TargetIds,
) {
  if (edges.length === 0) return 0;
  await tx.$executeRawUnsafe(
    `WITH input("legacyId", "targetTeacherId") AS (
       SELECT * FROM UNNEST($1::int[], $2::int[])
     ), source AS (
       SELECT input."legacyId", relation."sectionId", input."targetTeacherId"
       FROM input
       JOIN "SectionTeacher" relation ON relation."id" = input."legacyId"
     ), inserted AS (
     INSERT INTO "SectionTeacher" ("sectionId", "teacherId", "createdAt", "updatedAt", "retiredAt")
     SELECT DISTINCT "sectionId", "targetTeacherId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL
     FROM source
     ON CONFLICT ("sectionId", "teacherId") DO UPDATE SET "retiredAt" = NULL
     RETURNING "id", "sectionId", "teacherId"
     ), resolved AS (
       SELECT source."legacyId", source."sectionId", source."targetTeacherId",
              inserted."id" AS "targetRelationId"
       FROM source
       JOIN inserted ON inserted."sectionId" = source."sectionId"
                    AND inserted."teacherId" = source."targetTeacherId"
     ), comments AS (
       UPDATE "Comment" comment SET "sectionTeacherId" = resolved."targetRelationId"
       FROM resolved
       WHERE comment."sectionTeacherId" = resolved."legacyId"
     )
     INSERT INTO "_SectionTeachers" ("A", "B")
     SELECT DISTINCT "sectionId", "targetTeacherId" FROM resolved
     ON CONFLICT DO NOTHING`,
    edges.map((edge) => edge.ownerId),
    edges.map((edge) => edgeTargetId(edge, targetIds)),
  );
  return edges.length;
}

async function rebuildJoinEdges(
  tx: IdentityMigrationSql,
  edges: readonly EdgeMapping[],
  table: string,
  ownerColumn: "A" | "B",
  targets: Map<number, number>,
) {
  let count = 0;
  const a: number[] = [];
  const b: number[] = [];
  for (const edge of edges) {
    const targetId = targets.get(edge.targetJwId);
    if (targetId == null) throw new Error(`${edge.entity} target is missing`);
    a.push(ownerColumn === "A" ? edge.ownerId : targetId);
    b.push(ownerColumn === "A" ? targetId : edge.ownerId);
  }
  if (a.length === 0) return count;
  count += await tx.$executeRawUnsafe(
    `INSERT INTO "${table}" ("A", "B")
     SELECT * FROM UNNEST($1::int[], $2::int[])
     ON CONFLICT DO NOTHING`,
    a,
    b,
  );
  return count;
}

async function migrateComments(
  tx: IdentityMigrationSql,
  mappings: readonly EntityMapping[],
  targets: TargetIds,
) {
  for (const entity of ["course", "teacher"] as const) {
    const column = entity === "course" ? "courseId" : "teacherId";
    const updates = mappings
      .filter(
        (mapping) =>
          mapping.entity === entity && mapping.targetJwIds.length === 1,
      )
      .map((mapping) => ({
        legacyId: mapping.legacyId,
        targetId: targets.get(entity)?.get(mapping.targetJwIds[0]),
      }))
      .filter(
        (mapping): mapping is { legacyId: number; targetId: number } =>
          mapping.targetId != null && mapping.targetId !== mapping.legacyId,
      );
    if (updates.length > 0) {
      await tx.$executeRawUnsafe(
        `WITH input("legacyId", "targetId") AS (
           SELECT * FROM UNNEST($1::int[], $2::int[])
         )
         UPDATE "Comment" comment SET "${column}" = input."targetId"
         FROM input WHERE comment."${column}" = input."legacyId"`,
        updates.map((mapping) => mapping.legacyId),
        updates.map((mapping) => mapping.targetId),
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
    const sourceById = new Map(sourceRows.map((row) => [row.id, row]));
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
      const source = sourceById.get(mapping.legacyId);
      if (
        source?.description == null ||
        !descriptionsWithUserContent.has(source.description.id)
      ) {
        continue;
      }
      for (const targetJwId of mapping.targetJwIds) {
        const ids = descriptionsByTarget.get(targetJwId) ?? [];
        ids.push(source.description.id);
        descriptionsByTarget.set(targetJwId, ids);
      }
    }
    const duplicateUpdates: Array<{ duplicate: string; canonical: string }> =
      [];
    const canonicalUpdates: Array<{ id: string; targetId: number }> = [];
    for (const [targetJwId, ids] of descriptionsByTarget) {
      const uniqueIds = [...new Set(ids)].sort((a, b) => a.localeCompare(b));
      const canonical = uniqueIds[0];
      const targetId = targets.get(entity)?.get(targetJwId);
      if (canonical == null || targetId == null) continue;
      for (const duplicate of uniqueIds.slice(1)) {
        duplicateUpdates.push({ duplicate, canonical });
      }
      canonicalUpdates.push({ id: canonical, targetId });
    }
    if (duplicateUpdates.length > 0) {
      await tx.$executeRawUnsafe(
        `WITH input("duplicate", "canonical") AS (
           SELECT * FROM UNNEST($1::text[], $2::text[])
         )
         UPDATE "DescriptionEdit" edit SET "descriptionId" = input."canonical"
         FROM input WHERE edit."descriptionId" = input."duplicate"`,
        duplicateUpdates.map((item) => item.duplicate),
        duplicateUpdates.map((item) => item.canonical),
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "Description" WHERE "id" = ANY($1::text[])`,
        duplicateUpdates.map((item) => item.duplicate),
      );
    }
    if (canonicalUpdates.length > 0) {
      await tx.$executeRawUnsafe(
        `WITH input("id", "targetId") AS (
           SELECT * FROM UNNEST($1::text[], $2::int[])
         )
         UPDATE "Description" description SET "${column}" = input."targetId"
         FROM input WHERE description."id" = input."id"`,
        canonicalUpdates.map((item) => item.id),
        canonicalUpdates.map((item) => item.targetId),
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
  await tx.$executeRawUnsafe(
    `DELETE FROM "SectionTeacher" st
     WHERE NOT EXISTS (
       SELECT 1 FROM "_SectionTeachers" j
       WHERE j."A" = st."sectionId" AND j."B" = st."teacherId"
     ) AND NOT EXISTS (
       SELECT 1 FROM "Comment" c WHERE c."sectionTeacherId" = st."id"
     )`,
  );
  for (const entity of [
    "course",
    "adminClass",
    "examBatch",
    "department",
    "campus",
    "teacher",
    "teacherTitle",
  ] as const) {
    const legacyIds: number[] = [];
    for (const mapping of mappings.filter((item) => item.entity === entity)) {
      if (mapping.targetJwIds.length === 0) {
        if (mapping.provenance.includes("placeholder")) continue;
        legacyIds.push(mapping.legacyId);
        continue;
      }
      const targetDatabaseIds = new Set(
        mapping.targetJwIds
          .map((jwId) => targets.get(entity)?.get(jwId))
          .filter((id): id is number => id != null),
      );
      if (targetDatabaseIds.has(mapping.legacyId)) continue;
      legacyIds.push(mapping.legacyId);
    }
    if (legacyIds.length > 0) {
      if (entity === "teacherTitle") {
        await tx.$executeRawUnsafe(
          `UPDATE "Teacher" SET "teacherTitleId" = NULL
           WHERE "teacherTitleId" = ANY($1::int[])`,
          legacyIds,
        );
      }
      deleted += await tx.$executeRawUnsafe(
        `DELETE FROM "${tableForEntity(entity)}" WHERE "id" = ANY($1::int[])`,
        legacyIds,
      );
    }
  }
  return deleted;
}

async function deleteUnmappedTeacherAssignments(
  tx: IdentityMigrationSql,
  assignments: DatabaseState["teacherAssignments"],
  edges: readonly EdgeMapping[],
) {
  const mappedIds = new Set(
    edges
      .filter((edge) => edge.entity === "teacherAssignmentTeacher")
      .map((edge) => edge.ownerId),
  );
  const staleIds = assignments
    .map((assignment) => assignment.id)
    .filter((id) => !mappedIds.has(id));
  if (staleIds.length === 0) return;
  await tx.$executeRawUnsafe(
    `DELETE FROM "TeacherAssignment" WHERE "id" = ANY($1::int[])`,
    staleIds,
  );
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
