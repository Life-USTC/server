import {
  type DatabaseEntity,
  type DatabaseState,
  type EdgeMapping,
  type EntityMapping,
  type IdentityEntityKind,
  type IdentityMigrationBlocker,
  type IdentityMigrationPlan,
  RAW_JWID_MIGRATION_ID,
  type SnapshotEntity,
  type SnapshotState,
} from "./types";

type MappingEntity = EntityMapping["entity"];
type Provenance = EntityMapping["provenance"][number];

export function buildIdentityMigrationPlan(
  snapshotState: SnapshotState,
  databaseState: DatabaseState,
): IdentityMigrationPlan {
  const blockers: IdentityMigrationBlocker[] = [];

  validateSnapshotState(snapshotState, databaseState, blockers);
  const migrationState = databaseState.migrationState;
  if (
    migrationState != null &&
    migrationState.id === RAW_JWID_MIGRATION_ID &&
    migrationState.snapshotSha256 !== snapshotState.sha256
  ) {
    blockers.push({
      code: "MIGRATION_STATE_SHA_MISMATCH",
      entity: "migration",
      detail: `Migration ${RAW_JWID_MIGRATION_ID} was recorded for ${migrationState.snapshotSha256}, not ${snapshotState.sha256}`,
    });
  }

  if (
    blockers.length === 0 &&
    migrationState?.id === RAW_JWID_MIGRATION_ID &&
    migrationState.completed &&
    migrationState.snapshotSha256 === snapshotState.sha256
  ) {
    return finalizePlan(snapshotState.sha256, "already-completed", [], [], []);
  }

  if (!databaseState.legacyIdentityConstraintsPresent) {
    blockers.push({
      code: "LEGACY_IDENTITY_CONSTRAINTS_MISSING",
      entity: "migration",
      detail:
        "Legacy Department.code, ExamBatch.nameCn, and equivalent identity constraints must remain until raw jwId backfill commits",
    });
  }

  const entityMappings: EntityMapping[] = [];
  const edgeMappings: EdgeMapping[] = [];
  if (blockers.length === 0) {
    planCourses(
      snapshotState,
      databaseState,
      entityMappings,
      edgeMappings,
      blockers,
    );
    planNamedEntities(
      "adminClass",
      snapshotState.adminClasses,
      databaseState.adminClasses,
      entityMappings,
      blockers,
    );
    planAdminClassEdges(snapshotState, databaseState, edgeMappings, blockers);
    planNamedEntities(
      "teacherTitle",
      snapshotState.teacherTitles,
      databaseState.teacherTitles,
      entityMappings,
      blockers,
    );
    planNamedEntities(
      "examBatch",
      snapshotState.examBatches,
      databaseState.examBatches,
      entityMappings,
      blockers,
    );
    planExamBatchEdges(
      snapshotState,
      databaseState,
      entityMappings,
      edgeMappings,
      blockers,
    );
    planCodeEntities(
      "department",
      snapshotState.departments,
      databaseState.departments,
      entityMappings,
      blockers,
    );
    planNamedEntities(
      "campus",
      snapshotState.campuses,
      databaseState.campuses,
      entityMappings,
      blockers,
    );
    planTeachers(
      snapshotState,
      databaseState,
      entityMappings,
      edgeMappings,
      blockers,
    );
    planDepartmentEdges(
      snapshotState,
      databaseState,
      entityMappings,
      edgeMappings,
      blockers,
    );
    planCampusEdges(
      snapshotState,
      databaseState,
      entityMappings,
      edgeMappings,
      blockers,
    );
    planTeacherAssignmentEdges(
      snapshotState,
      databaseState,
      entityMappings,
      edgeMappings,
      blockers,
    );
    planScheduleTeacherEdges(
      snapshotState,
      databaseState,
      entityMappings,
      edgeMappings,
    );
    planImplicitSectionTeacherEdges(
      snapshotState,
      databaseState,
      entityMappings,
      edgeMappings,
    );
    validateDescriptionConflicts(
      "course",
      databaseState.courses,
      entityMappings,
      blockers,
    );
    validateDescriptionConflicts(
      "teacher",
      databaseState.teachers,
      entityMappings,
      blockers,
    );
  }

  return finalizePlan(
    snapshotState.sha256,
    blockers.length > 0 ? "blocked" : "plan",
    entityMappings,
    edgeMappings,
    blockers,
  );
}

function validateSnapshotState(
  snapshot: SnapshotState,
  database: DatabaseState,
  blockers: IdentityMigrationBlocker[],
) {
  if (
    snapshot.sha256 !== database.expectedSnapshotSha256 ||
    snapshot.sha256 !== database.globalSnapshotSha256
  ) {
    blockers.push({
      code: "SNAPSHOT_STATE_SHA_MISMATCH",
      entity: "migration",
      detail: `Expected, loaded, and global snapshot SHA-256 must match exactly: expected=${database.expectedSnapshotSha256}, loaded=${snapshot.sha256}, global=${database.globalSnapshotSha256 ?? "missing"}`,
    });
  }

  for (const [entity, rows] of [
    ["course", snapshot.courses],
    ["adminClass", snapshot.adminClasses],
    ["teacherTitle", snapshot.teacherTitles],
    ["examBatch", snapshot.examBatches],
    ["department", snapshot.departments],
    ["campus", snapshot.campuses],
    ["teacher", snapshot.teachers],
  ] as const) {
    const byJwId = groupBy(rows, (row) => row.jwId);
    for (const [jwId, occurrences] of byJwId) {
      const payloads = new Set(
        occurrences.map(({ jwId: _jwId, ...row }) => stableJson(row)),
      );
      if (payloads.size > 1) {
        blockers.push({
          code: "SOURCE_ID_PAYLOAD_CONFLICT",
          entity,
          sourceJwId: jwId,
          detail: `${entity} source jwId ${jwId} has ${payloads.size} payloads`,
        });
      }
    }
  }
}

function planCourses(
  snapshot: SnapshotState,
  database: DatabaseState,
  mappings: EntityMapping[],
  edges: EdgeMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  const rawByJwId = new Map(snapshot.courses.map((row) => [row.jwId, row]));
  const byCode = groupBy(
    snapshot.courses.filter((row) => row.code != null && row.code !== ""),
    (row) => row.code as string,
  );
  const bySynthetic = groupBy(
    snapshot.courses.flatMap((row) =>
      (row.legacySyntheticJwIds ?? []).map((legacyJwId) => ({
        legacyJwId,
        row,
      })),
    ),
    (entry) => entry.legacyJwId,
  );
  for (const course of database.courses) {
    const targets = new Set<number>();
    const provenance = new Set<Provenance>();
    if (rawByJwId.has(course.jwId)) {
      targets.add(course.jwId);
      provenance.add("raw");
    }
    for (const target of bySynthetic.get(course.jwId) ?? []) {
      targets.add(target.row.jwId);
      provenance.add("synthetic");
    }
    if (targets.size === 0 && course.code != null && course.code !== "") {
      const codeMatches = byCode.get(course.code) ?? [];
      if (codeMatches.length === 1) {
        targets.add(codeMatches[0].jwId);
        provenance.add("code");
      }
    }
    const targetJwIds = sortedNumbers(targets);
    if (targetJwIds.length === 0) {
      addUnmappedBlocker(
        "course",
        course.id,
        blockers,
        stableJson({
          jwId: course.jwId,
          code: course.code,
          nameCn: course.nameCn,
          directCommentCount: course.directCommentCount,
          descriptionId: course.description?.id ?? null,
        }),
      );
    }
    const hasDirectUgc =
      course.directCommentCount > 0 || hasNonemptyDescription(course);
    if (hasDirectUgc && targetJwIds.length > 1) {
      addUgcBlocker("course", course.id, targetJwIds, blockers);
    }
    mappings.push({
      entity: "course",
      legacyId: course.id,
      targetJwIds,
      provenance: sortedStrings(provenance),
    });
  }

  const courseMapping = mappingByLegacyId(mappings, "course");
  const snapshotEdges = new Map(
    snapshot.sectionCourses.map((edge) => [edge.sectionJwId, edge.courseJwId]),
  );
  for (const section of database.sections) {
    const sourceTarget = snapshotEdges.get(section.jwId);
    if (sourceTarget != null) {
      if (!rawByJwId.has(sourceTarget)) {
        addSourceEdgeBlocker(
          "sectionCourse",
          section.id,
          sourceTarget,
          blockers,
        );
      } else {
        edges.push({
          entity: "sectionCourse",
          ownerId: section.id,
          targetJwId: sourceTarget,
        });
      }
      continue;
    }
    const targets = courseMapping.get(section.courseId)?.targetJwIds ?? [];
    planLegacyEdge("sectionCourse", section.id, targets, edges, blockers);
  }
}

function planNamedEntities(
  entity: MappingEntity,
  snapshotRows: readonly SnapshotEntity[],
  databaseRows: readonly DatabaseEntity[],
  mappings: EntityMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  planSimpleEntities(
    entity,
    snapshotRows,
    databaseRows,
    (row, snapshot) => {
      const targets = snapshot
        .filter((item) => item.nameCn === row.nameCn)
        .map((item) => item.jwId);
      const provenance: Provenance[] = ["name"];
      if (row.jwId != null && snapshot.some((item) => item.jwId === row.jwId)) {
        targets.push(row.jwId);
        provenance.push("raw");
      }
      return { targets, provenance };
    },
    mappings,
    blockers,
  );
}

function planCodeEntities(
  entity: MappingEntity,
  snapshotRows: readonly SnapshotEntity[],
  databaseRows: readonly DatabaseEntity[],
  mappings: EntityMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  planSimpleEntities(
    entity,
    snapshotRows,
    databaseRows,
    (row, snapshot) => {
      if (row.jwId != null && snapshot.some((item) => item.jwId === row.jwId)) {
        return { targets: [row.jwId], provenance: ["raw"] };
      }
      return {
        targets: snapshot
          .filter(
            (item) =>
              row.code != null && row.code !== "" && item.code === row.code,
          )
          .map((item) => item.jwId),
        provenance:
          entity === "department" &&
          row.jwId == null &&
          !snapshot.some(
            (item) =>
              row.code != null && row.code !== "" && item.code === row.code,
          )
            ? ["placeholder"]
            : ["code"],
      };
    },
    mappings,
    blockers,
  );
}

function planSimpleEntities(
  entity: MappingEntity,
  snapshotRows: readonly SnapshotEntity[],
  databaseRows: readonly DatabaseEntity[],
  resolve: (
    row: DatabaseEntity,
    snapshot: readonly SnapshotEntity[],
  ) => { targets: number[]; provenance: Provenance[] },
  mappings: EntityMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  for (const row of databaseRows) {
    const resolved = resolve(row, snapshotRows);
    const targetJwIds = sortedNumbers(new Set(resolved.targets));
    if (
      targetJwIds.length === 0 &&
      !resolved.provenance.includes("placeholder")
    ) {
      addUnmappedBlocker(entity, row.id, blockers, stableJson(row));
    }
    if (entity === "department" && targetJwIds.length > 1) {
      blockers.push({
        code: "LEGACY_ENTITY_MULTI_TARGET",
        entity,
        legacyId: row.id,
        detail: `Department ${row.id} code maps to raw jwIds ${targetJwIds.join(",")}`,
      });
    }
    mappings.push({
      entity,
      legacyId: row.id,
      targetJwIds,
      provenance: sortedStrings(new Set(resolved.provenance)),
    });
  }
}

function planAdminClassEdges(
  snapshot: SnapshotState,
  database: DatabaseState,
  edges: EdgeMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  const sectionById = new Map(database.sections.map((row) => [row.id, row]));
  const rawIds = new Set(snapshot.adminClasses.map((row) => row.jwId));
  const sourceEdges = new Map<string, number>();
  for (const edge of snapshot.sectionAdminClasses) {
    sourceEdges.set(
      `${edge.sectionJwId}:${edge.adminClassJwId}`,
      edge.adminClassJwId,
    );
  }
  for (const edge of database.sectionAdminClasses) {
    const section = sectionById.get(edge.sectionId);
    if (section == null) {
      addSourceEdgeBlocker(
        "sectionAdminClass",
        edge.sectionId,
        edge.adminClassId,
        blockers,
      );
      continue;
    }
    const sourceTargets = [...sourceEdges]
      .filter(([key]) => key.startsWith(`${section.jwId}:`))
      .map(([, jwId]) => jwId)
      .filter((jwId) => rawIds.has(jwId));
    if (sourceTargets.length > 0) {
      for (const targetJwId of sortedNumbers(new Set(sourceTargets))) {
        edges.push({
          entity: "sectionAdminClass",
          ownerId: section.id,
          targetJwId,
        });
      }
    }
  }
}

function planExamBatchEdges(
  snapshot: SnapshotState,
  database: DatabaseState,
  mappings: EntityMapping[],
  edges: EdgeMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  const sourceEdges = new Map(
    snapshot.examBatchesByExam.map((edge) => [
      edge.examJwId,
      edge.examBatchJwId,
    ]),
  );
  const rawIds = new Set(snapshot.examBatches.map((row) => row.jwId));
  const batchMappings = mappingByLegacyId(mappings, "examBatch");
  for (const exam of database.exams) {
    const sourceTarget = sourceEdges.get(exam.jwId);
    if (sourceTarget != null) {
      if (!rawIds.has(sourceTarget)) {
        addSourceEdgeBlocker("examBatchEdge", exam.id, sourceTarget, blockers);
      } else {
        edges.push({
          entity: "examBatchEdge",
          ownerId: exam.id,
          targetJwId: sourceTarget,
        });
      }
      continue;
    }
    if (exam.examBatchId == null) continue;
    const targets = batchMappings.get(exam.examBatchId)?.targetJwIds ?? [];
    planLegacyEdge("examBatchEdge", exam.id, targets, edges, blockers);
  }
}

function planDepartmentEdges(
  snapshot: SnapshotState,
  database: DatabaseState,
  mappings: EntityMapping[],
  edges: EdgeMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  const departmentMappings = mappingByLegacyId(mappings, "department");
  const sectionById = new Map(database.sections.map((row) => [row.id, row]));
  const teacherMappings = mappingByLegacyId(mappings, "teacher");
  const sourceReferencesByOwner = groupBy(
    snapshot.departmentCodeReferences,
    (row) => `${row.ownerType}:${row.ownerJwId}`,
  );
  const departmentById = new Map(
    database.departments.map((row) => [row.id, row]),
  );
  for (const reference of database.departmentReferences) {
    const mapping = departmentMappings.get(reference.departmentId);
    if (mapping?.provenance.includes("placeholder")) {
      const departmentCode = departmentById.get(reference.departmentId)?.code;
      const ownerJwIds =
        reference.ownerType === "section"
          ? [sectionById.get(reference.ownerId)?.jwId].filter(
              (jwId): jwId is number => jwId != null,
            )
          : (teacherMappings.get(reference.ownerId)?.targetJwIds ?? []);
      const sourceReferences = ownerJwIds.flatMap(
        (ownerJwId) =>
          sourceReferencesByOwner.get(`${reference.ownerType}:${ownerJwId}`) ??
          [],
      );
      if (
        sourceReferences.length > 0 &&
        !sourceReferences.some(
          (source) => source.departmentCode === departmentCode,
        )
      ) {
        blockers.push({
          code: "SOURCE_EDGE_UNMAPPED",
          entity: "departmentEdge",
          legacyId: reference.ownerId,
          detail: `${reference.ownerType} ${reference.ownerId} does not prove retained Department code ${departmentCode ?? "missing"}`,
        });
      }
      continue;
    }
    const targets = mapping?.targetJwIds ?? [];
    planLegacyEdge(
      "departmentEdge",
      reference.ownerId,
      targets,
      edges,
      blockers,
      {
        ownerType: reference.ownerType,
      },
    );
  }
}

function planCampusEdges(
  snapshot: SnapshotState,
  database: DatabaseState,
  mappings: EntityMapping[],
  edges: EdgeMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  const validCampusIds = new Set(snapshot.campuses.map((row) => row.jwId));
  const campusMappings = mappingByLegacyId(mappings, "campus");
  const buildingSource = new Map(
    snapshot.buildingCampuses.map((edge) => [
      edge.buildingJwId,
      edge.campusJwId,
    ]),
  );
  for (const building of database.buildings) {
    if (building.campusId == null) continue;
    planSourceBackedOrLegacyEdge(
      "buildingCampus",
      building.id,
      buildingSource.get(building.jwId),
      campusMappings.get(building.campusId)?.targetJwIds ?? [],
      validCampusIds,
      edges,
      blockers,
    );
  }
  const sectionSource = new Map(
    snapshot.sectionCampuses.map((edge) => [edge.sectionJwId, edge.campusJwId]),
  );
  for (const section of database.sections) {
    if (section.campusId == null) continue;
    planSourceBackedOrLegacyEdge(
      "sectionCampus",
      section.id,
      sectionSource.get(section.jwId),
      campusMappings.get(section.campusId)?.targetJwIds ?? [],
      validCampusIds,
      edges,
      blockers,
    );
  }
}

function planSourceBackedOrLegacyEdge(
  entity: EdgeMapping["entity"],
  ownerId: number,
  sourceTarget: number | undefined,
  legacyTargets: readonly number[],
  validTargets: ReadonlySet<number>,
  edges: EdgeMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  if (sourceTarget == null) {
    planLegacyEdge(entity, ownerId, legacyTargets, edges, blockers);
    return;
  }
  if (!validTargets.has(sourceTarget)) {
    addSourceEdgeBlocker(entity, ownerId, sourceTarget, blockers);
    return;
  }
  edges.push({ entity, ownerId, targetJwId: sourceTarget });
}

function planTeachers(
  snapshot: SnapshotState,
  database: DatabaseState,
  mappings: EntityMapping[],
  edges: EdgeMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  const rawByJwId = new Map(snapshot.teachers.map((row) => [row.jwId, row]));
  const byPerson = groupBy(
    snapshot.teachers.filter((row) => row.personId != null),
    (row) => row.personId as number,
  );
  const byCode = groupBy(
    snapshot.teachers.filter((row) => row.code != null && row.code !== ""),
    (row) => row.code as string,
  );
  for (const teacher of database.teachers) {
    const targets = new Set<number>();
    const provenance = new Set<Provenance>();
    const directJwId = teacher.jwId ?? teacher.teacherId;
    if (directJwId != null && rawByJwId.has(directJwId)) {
      targets.add(directJwId);
      provenance.add("raw");
    }
    if (teacher.personId != null) {
      for (const target of byPerson.get(teacher.personId) ?? []) {
        targets.add(target.jwId);
        provenance.add("person");
      }
    }
    if (targets.size === 0 && teacher.code != null && teacher.code !== "") {
      const codeMatches = byCode.get(teacher.code) ?? [];
      if (codeMatches.length === 1) {
        targets.add(codeMatches[0].jwId);
        provenance.add("code");
      }
    }
    const targetJwIds = sortedNumbers(targets);
    if (targetJwIds.length === 0) {
      addUnmappedBlocker(
        "teacher",
        teacher.id,
        blockers,
        stableJson({
          jwId: teacher.jwId,
          teacherId: teacher.teacherId,
          personId: teacher.personId,
          code: teacher.code,
          nameCn: teacher.nameCn,
          directCommentCount: teacher.directCommentCount,
          descriptionId: teacher.description?.id ?? null,
        }),
      );
    }
    if (
      (teacher.directCommentCount > 0 || hasNonemptyDescription(teacher)) &&
      targetJwIds.length > 1
    ) {
      addUgcBlocker("teacher", teacher.id, targetJwIds, blockers);
    }
    mappings.push({
      entity: "teacher",
      legacyId: teacher.id,
      targetJwIds,
      provenance: sortedStrings(provenance),
    });
  }

  const sectionById = new Map(database.sections.map((row) => [row.id, row]));
  const teacherMappings = mappingByLegacyId(mappings, "teacher");
  const sourceTargetsBySection = groupBy(
    snapshot.sectionTeachers,
    (row) => row.sectionJwId,
  );
  for (const relation of database.sectionTeachers) {
    const section = sectionById.get(relation.sectionId);
    const sourceCandidates =
      section == null ? [] : (sourceTargetsBySection.get(section.jwId) ?? []);
    const oldTargets =
      teacherMappings.get(relation.teacherId)?.targetJwIds ?? [];
    const constrainedTargets = sourceCandidates
      .map((row) => row.teacherJwId)
      .filter((jwId) => oldTargets.includes(jwId));
    const targets =
      constrainedTargets.length > 0
        ? sortedNumbers(new Set(constrainedTargets))
        : oldTargets;
    if (relation.directCommentCount > 0 && targets.length > 1) {
      addUgcBlocker("sectionTeacher", relation.id, targets, blockers);
    }
    planLegacyEdge("sectionTeacher", relation.id, targets, edges, blockers);
  }
}

function planTeacherAssignmentEdges(
  snapshot: SnapshotState,
  database: DatabaseState,
  mappings: EntityMapping[],
  edges: EdgeMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  const sectionById = new Map(database.sections.map((row) => [row.id, row]));
  const teacherMappings = mappingByLegacyId(mappings, "teacher");
  const validTitleIds = new Set(snapshot.teacherTitles.map((row) => row.jwId));
  const sourceBySection = groupBy(
    snapshot.teacherAssignments,
    (row) => row.sectionJwId,
  );

  for (const assignment of database.teacherAssignments) {
    const section = sectionById.get(assignment.sectionId);
    const teacherTargets =
      teacherMappings.get(assignment.teacherId)?.targetJwIds ?? [];
    const sourceAssignments =
      section == null ? [] : (sourceBySection.get(section.jwId) ?? []);
    const sourceTeacherTargets = sortedNumbers(
      new Set(
        sourceAssignments
          .map((row) => row.teacherJwId)
          .filter((jwId) => teacherTargets.includes(jwId)),
      ),
    );
    const assignmentTeacherTargets =
      sourceTeacherTargets.length > 0
        ? sourceTeacherTargets
        : teacherTargets.length === 1
          ? teacherTargets
          : [];
    planLegacyEdge(
      "teacherAssignmentTeacher",
      assignment.id,
      assignmentTeacherTargets,
      edges,
      blockers,
    );
    const titleTargets = sourceAssignments
      .filter((row) => teacherTargets.includes(row.teacherJwId))
      .map((row) => row.titleJwId)
      .filter((jwId): jwId is number => jwId != null);

    for (const titleJwId of titleTargets) {
      if (!validTitleIds.has(titleJwId)) {
        addSourceEdgeBlocker(
          "teacherAssignmentTitle",
          assignment.id,
          titleJwId,
          blockers,
        );
      }
    }
    const validTargets = sortedNumbers(
      new Set(titleTargets.filter((jwId) => validTitleIds.has(jwId))),
    );
    if (validTargets.length > 0) {
      planLegacyEdge(
        "teacherAssignmentTitle",
        assignment.id,
        validTargets,
        edges,
        blockers,
      );
    }
  }
}

function planScheduleTeacherEdges(
  snapshot: SnapshotState,
  database: DatabaseState,
  mappings: EntityMapping[],
  edges: EdgeMapping[],
) {
  const sectionById = new Map(database.sections.map((row) => [row.id, row]));
  const teacherMappings = mappingByLegacyId(mappings, "teacher");
  const sourceTargetsBySection = groupBy(
    snapshot.sectionTeachers,
    (row) => row.sectionJwId,
  );
  for (const relation of database.scheduleTeachers) {
    const section = sectionById.get(relation.sectionId);
    const legacyTargets =
      teacherMappings.get(relation.teacherId)?.targetJwIds ?? [];
    const sourceTargets =
      section == null
        ? []
        : (sourceTargetsBySection.get(section.jwId) ?? [])
            .map((row) => row.teacherJwId)
            .filter((jwId) => legacyTargets.includes(jwId));
    for (const targetJwId of sortedNumbers(new Set(sourceTargets))) {
      edges.push({
        entity: "scheduleTeacher",
        ownerId: relation.scheduleId,
        targetJwId,
      });
    }
  }
}

function planImplicitSectionTeacherEdges(
  snapshot: SnapshotState,
  database: DatabaseState,
  mappings: EntityMapping[],
  edges: EdgeMapping[],
) {
  const sectionById = new Map(database.sections.map((row) => [row.id, row]));
  const teacherMappings = mappingByLegacyId(mappings, "teacher");
  const sourceTargetsBySection = groupBy(
    snapshot.sectionTeachers,
    (row) => row.sectionJwId,
  );
  for (const relation of database.sectionTeacherJoins) {
    const section = sectionById.get(relation.sectionId);
    const legacyTargets =
      teacherMappings.get(relation.teacherId)?.targetJwIds ?? [];
    const sourceTargets =
      section == null
        ? []
        : (sourceTargetsBySection.get(section.jwId) ?? [])
            .map((row) => row.teacherJwId)
            .filter((jwId) => legacyTargets.includes(jwId));
    const targets = sortedNumbers(new Set(sourceTargets));
    for (const targetJwId of targets) {
      edges.push({
        entity: "implicitSectionTeacher",
        ownerId: relation.sectionId,
        targetJwId,
      });
    }
  }
}

function validateDescriptionConflicts(
  entity: "course" | "teacher",
  rows: readonly {
    id: number;
    description: { id: string; contentFingerprint: string } | null;
  }[],
  mappings: readonly EntityMapping[],
  blockers: IdentityMigrationBlocker[],
) {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const descriptionsByTarget = new Map<
    number,
    Array<{ id: string; contentFingerprint: string }>
  >();
  for (const mapping of mappings.filter((item) => item.entity === entity)) {
    const description = rowById.get(mapping.legacyId)?.description;
    if (description == null || description.contentFingerprint === "") continue;
    for (const targetJwId of mapping.targetJwIds) {
      const descriptions = descriptionsByTarget.get(targetJwId) ?? [];
      descriptions.push(description);
      descriptionsByTarget.set(targetJwId, descriptions);
    }
  }
  for (const [targetJwId, descriptions] of descriptionsByTarget) {
    const fingerprints = new Set(
      descriptions.map((description) => description.contentFingerprint),
    );
    if (fingerprints.size <= 1) continue;
    blockers.push({
      code: "DESCRIPTION_CONFLICT",
      entity,
      sourceJwId: targetJwId,
      detail: `${entity} target ${targetJwId} receives conflicting descriptions ${descriptions
        .map((description) => description.id)
        .sort((left, right) => left.localeCompare(right))
        .join(",")}`,
    });
  }
}

function hasNonemptyDescription(row: {
  description: { contentFingerprint: string } | null;
}) {
  return row.description != null && row.description.contentFingerprint !== "";
}

function planLegacyEdge(
  entity: EdgeMapping["entity"],
  ownerId: number,
  targets: readonly number[],
  edges: EdgeMapping[],
  blockers: IdentityMigrationBlocker[],
  metadata: Pick<EdgeMapping, "ownerType"> = {},
) {
  if (targets.length === 1) {
    edges.push({ entity, ownerId, targetJwId: targets[0], ...metadata });
    return;
  }
  blockers.push({
    code:
      targets.length === 0
        ? "SOURCE_EDGE_UNMAPPED"
        : "LEGACY_EDGE_MULTI_TARGET",
    entity,
    legacyId: ownerId,
    detail:
      targets.length === 0
        ? `${entity} owner ${ownerId} has no target`
        : `${entity} owner ${ownerId} has targets ${targets.join(",")}`,
  });
}

function addUnmappedBlocker(
  entity: MappingEntity,
  legacyId: number,
  blockers: IdentityMigrationBlocker[],
  context: string,
) {
  blockers.push({
    code: "LEGACY_ENTITY_UNMAPPED",
    entity,
    legacyId,
    detail: `${entity} ${legacyId} has no provable raw jwId: ${context}`,
  });
}

function addSourceEdgeBlocker(
  entity: EdgeMapping["entity"],
  legacyId: number,
  sourceJwId: number,
  blockers: IdentityMigrationBlocker[],
) {
  blockers.push({
    code: "SOURCE_EDGE_UNMAPPED",
    entity,
    legacyId,
    sourceJwId,
    detail: `${entity} owner ${legacyId} references missing source jwId ${sourceJwId}`,
  });
}

function addUgcBlocker(
  entity: IdentityEntityKind,
  legacyId: number,
  targets: readonly number[],
  blockers: IdentityMigrationBlocker[],
) {
  blockers.push({
    code: "UGC_MULTI_TARGET",
    entity,
    legacyId,
    detail: `${entity} ${legacyId} has UGC and targets ${targets.join(",")}`,
  });
}

function mappingByLegacyId(
  mappings: readonly EntityMapping[],
  entity: MappingEntity,
) {
  return new Map(
    mappings
      .filter((mapping) => mapping.entity === entity)
      .map((mapping) => [mapping.legacyId, mapping]),
  );
}

function groupBy<T, K>(rows: readonly T[], key: (row: T) => K) {
  const result = new Map<K, T[]>();
  for (const row of rows) {
    const value = key(row);
    const group = result.get(value) ?? [];
    group.push(row);
    result.set(value, group);
  }
  return result;
}

function finalizePlan(
  snapshotSha256: string,
  mode: IdentityMigrationPlan["mode"],
  mappings: EntityMapping[],
  edges: EdgeMapping[],
  blockers: IdentityMigrationBlocker[],
): IdentityMigrationPlan {
  const entityMappings = [...mappings].sort(
    (left, right) =>
      left.entity.localeCompare(right.entity) || left.legacyId - right.legacyId,
  );
  const edgeMappings = [...edges].sort(
    (left, right) =>
      left.entity.localeCompare(right.entity) ||
      left.ownerId - right.ownerId ||
      (left.ownerType ?? "").localeCompare(right.ownerType ?? "") ||
      left.targetJwId - right.targetJwId,
  );
  const stableBlockers = [...blockers].sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.entity.localeCompare(right.entity) ||
      (left.legacyId ?? -1) - (right.legacyId ?? -1) ||
      (left.sourceJwId ?? -1) - (right.sourceJwId ?? -1) ||
      left.detail.localeCompare(right.detail),
  );
  const splitCount = (entity: MappingEntity) =>
    entityMappings.filter(
      (mapping) => mapping.entity === entity && mapping.targetJwIds.length > 1,
    ).length;
  return {
    migrationId: RAW_JWID_MIGRATION_ID,
    snapshotSha256,
    mode,
    entityMappings,
    edgeMappings,
    blockers: stableBlockers,
    report: {
      snapshotSha256,
      mode,
      blockerCount: stableBlockers.length,
      mappingCount: entityMappings.length,
      edgeMappingCount: edgeMappings.length,
      splitCounts: {
        courses: splitCount("course"),
        adminClasses: splitCount("adminClass"),
        teachers: splitCount("teacher"),
        retainedDepartmentPlaceholders: entityMappings.filter(
          (mapping) =>
            mapping.entity === "department" &&
            mapping.provenance.includes("placeholder"),
        ).length,
      },
    },
  };
}

function stableJson(value: object) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}

function sortedNumbers(values: ReadonlySet<number>) {
  return [...values].sort((left, right) => left - right);
}

function sortedStrings<T extends string>(values: ReadonlySet<T>): T[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}
