export const RAW_JWID_MIGRATION_ID = "raw-jwid-v1";

export type SnapshotEntity = {
  jwId: number;
  nameCn: string;
  code?: string | null;
};

export type SnapshotCourse = SnapshotEntity & {
  /** Synthetic ID produced by the retired semantic-identity loader. */
  legacySyntheticJwId?: number | null;
};

export type SnapshotTeacher = SnapshotEntity & {
  personId?: number | null;
  departmentJwId?: number | null;
};

export type LegacyDescription = {
  id: string;
  /** Empty means the description has no user content. */
  contentFingerprint: string;
};

export type SnapshotState = {
  sha256: string;
  courses: readonly SnapshotCourse[];
  sectionCourses: readonly { sectionJwId: number; courseJwId: number }[];
  adminClasses: readonly SnapshotEntity[];
  sectionAdminClasses: readonly {
    sectionJwId: number;
    adminClassJwId: number;
  }[];
  teacherTitles: readonly SnapshotEntity[];
  examBatches: readonly SnapshotEntity[];
  examBatchesByExam: readonly { examJwId: number; examBatchJwId: number }[];
  departments: readonly SnapshotEntity[];
  teachers: readonly SnapshotTeacher[];
  sectionTeachers: readonly {
    sectionJwId: number;
    teacherJwId: number;
  }[];
  teacherAssignments: readonly {
    sectionJwId: number;
    teacherJwId: number;
    titleJwId: number | null;
  }[];
};

export type DatabaseCourse = SnapshotEntity & {
  id: number;
  directCommentCount: number;
  description: LegacyDescription | null;
};

export type DatabaseEntity = {
  id: number;
  jwId?: number | null;
  nameCn: string;
  code?: string | null;
};

export type DatabaseTeacher = DatabaseEntity & {
  teacherId?: number | null;
  personId?: number | null;
  directCommentCount: number;
  description: LegacyDescription | null;
};

export type DatabaseState = {
  expectedSnapshotSha256: string;
  globalSnapshotSha256: string | null;
  /** Legacy identity constraints must remain until the data migration commits. */
  legacyIdentityConstraintsPresent: boolean;
  migrationState: {
    id: string;
    snapshotSha256: string;
    completed: boolean;
  } | null;
  courses: readonly DatabaseCourse[];
  courseAliases: readonly { jwId: number; courseId: number }[];
  sections: readonly { id: number; jwId: number; courseId: number }[];
  adminClasses: readonly DatabaseEntity[];
  sectionAdminClasses: readonly {
    sectionId: number;
    adminClassId: number;
  }[];
  teacherTitles: readonly DatabaseEntity[];
  examBatches: readonly DatabaseEntity[];
  exams: readonly { id: number; jwId: number; examBatchId: number | null }[];
  departments: readonly DatabaseEntity[];
  departmentReferences: readonly {
    ownerType: "section" | "teacher";
    ownerId: number;
    departmentId: number;
  }[];
  teachers: readonly DatabaseTeacher[];
  sectionTeachers: readonly {
    id: number;
    sectionId: number;
    teacherId: number;
    directCommentCount: number;
  }[];
  teacherAssignments: readonly {
    id: number;
    sectionId: number;
    teacherId: number;
    /** Legacy Teacher-level title inherited by this assignment, if any. */
    legacyTeacherTitleId: number | null;
  }[];
};

export type IdentityEntityKind =
  | "course"
  | "adminClass"
  | "teacherTitle"
  | "examBatch"
  | "department"
  | "teacher"
  | "sectionCourse"
  | "sectionAdminClass"
  | "examBatchEdge"
  | "departmentEdge"
  | "sectionTeacher"
  | "teacherAssignmentTitle";

export type IdentityMigrationBlockerCode =
  | "SNAPSHOT_STATE_SHA_MISMATCH"
  | "MIGRATION_STATE_SHA_MISMATCH"
  | "LEGACY_IDENTITY_CONSTRAINTS_MISSING"
  | "SOURCE_ID_PAYLOAD_CONFLICT"
  | "LEGACY_ENTITY_UNMAPPED"
  | "SOURCE_EDGE_UNMAPPED"
  | "LEGACY_EDGE_MULTI_TARGET"
  | "UGC_MULTI_TARGET"
  | "COURSE_ALIAS_UGC_PROVENANCE_LOST"
  | "COURSE_ALIAS_TARGET_NOT_IN_SNAPSHOT"
  | "DESCRIPTION_CONFLICT";

export type IdentityMigrationBlocker = {
  code: IdentityMigrationBlockerCode;
  entity: IdentityEntityKind | "migration";
  legacyId?: number;
  sourceJwId?: number;
  detail: string;
};

export type EntityMapping = {
  entity: Exclude<
    IdentityEntityKind,
    | "sectionCourse"
    | "sectionAdminClass"
    | "examBatchEdge"
    | "departmentEdge"
    | "sectionTeacher"
    | "teacherAssignmentTitle"
  >;
  legacyId: number;
  targetJwIds: number[];
  provenance: Array<"raw" | "synthetic" | "alias" | "code" | "name" | "person">;
};

export type EdgeMapping = {
  entity: Extract<
    IdentityEntityKind,
    | "sectionCourse"
    | "sectionAdminClass"
    | "examBatchEdge"
    | "departmentEdge"
    | "sectionTeacher"
    | "teacherAssignmentTitle"
  >;
  ownerId: number;
  targetJwId: number;
};

export type IdentityMigrationReport = {
  snapshotSha256: string;
  mode: "plan" | "already-completed" | "blocked";
  blockerCount: number;
  mappingCount: number;
  edgeMappingCount: number;
  splitCounts: {
    courses: number;
    adminClasses: number;
    teachers: number;
  };
};

export type IdentityMigrationPlan = {
  migrationId: typeof RAW_JWID_MIGRATION_ID;
  snapshotSha256: string;
  mode: IdentityMigrationReport["mode"];
  entityMappings: EntityMapping[];
  edgeMappings: EdgeMapping[];
  blockers: IdentityMigrationBlocker[];
  report: IdentityMigrationReport;
};
