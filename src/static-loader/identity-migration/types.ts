export const RAW_JWID_MIGRATION_ID = "raw-jwid-v1";

export type SnapshotEntity = {
  jwId: number;
  nameCn: string;
  code?: string | null;
};

export type SnapshotCourse = SnapshotEntity & {
  /** Synthetic IDs produced by retired code- and semantic-identity loaders. */
  legacySyntheticJwIds?: readonly number[];
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
  departmentCodeReferences: readonly {
    ownerType: "section" | "teacher";
    ownerJwId: number;
    departmentCode: string;
  }[];
  campuses: readonly SnapshotEntity[];
  buildingCampuses: readonly { buildingJwId: number; campusJwId: number }[];
  sectionCampuses: readonly { sectionJwId: number; campusJwId: number }[];
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
  sections: readonly {
    id: number;
    jwId: number;
    courseId: number;
    campusId: number | null;
  }[];
  adminClasses: readonly DatabaseEntity[];
  sectionAdminClasses: readonly {
    sectionId: number;
    adminClassId: number;
  }[];
  teacherTitles: readonly DatabaseEntity[];
  examBatches: readonly DatabaseEntity[];
  exams: readonly { id: number; jwId: number; examBatchId: number | null }[];
  departments: readonly DatabaseEntity[];
  campuses: readonly DatabaseEntity[];
  buildings: readonly {
    id: number;
    jwId: number;
    campusId: number | null;
  }[];
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
  sectionTeacherJoins: readonly {
    sectionId: number;
    teacherId: number;
  }[];
  teacherAssignments: readonly {
    id: number;
    sectionId: number;
    teacherId: number;
  }[];
  scheduleTeachers: readonly {
    scheduleId: number;
    sectionId: number;
    teacherId: number;
  }[];
};

export type IdentityEntityKind =
  | "course"
  | "adminClass"
  | "teacherTitle"
  | "examBatch"
  | "department"
  | "campus"
  | "teacher"
  | "sectionCourse"
  | "sectionAdminClass"
  | "examBatchEdge"
  | "departmentEdge"
  | "buildingCampus"
  | "sectionCampus"
  | "sectionTeacher"
  | "implicitSectionTeacher"
  | "teacherAssignmentTeacher"
  | "scheduleTeacher"
  | "teacherAssignmentTitle";

export type IdentityMigrationBlockerCode =
  | "SNAPSHOT_STATE_SHA_MISMATCH"
  | "MIGRATION_STATE_SHA_MISMATCH"
  | "LEGACY_IDENTITY_CONSTRAINTS_MISSING"
  | "SOURCE_ID_PAYLOAD_CONFLICT"
  | "LEGACY_ENTITY_UNMAPPED"
  | "LEGACY_ENTITY_MULTI_TARGET"
  | "SOURCE_EDGE_UNMAPPED"
  | "LEGACY_EDGE_MULTI_TARGET"
  | "UGC_MULTI_TARGET"
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
    | "buildingCampus"
    | "sectionCampus"
    | "sectionTeacher"
    | "implicitSectionTeacher"
    | "teacherAssignmentTeacher"
    | "scheduleTeacher"
    | "teacherAssignmentTitle"
  >;
  legacyId: number;
  targetJwIds: number[];
  provenance: Array<
    | "raw"
    | "historical"
    | "synthetic"
    | "code"
    | "name"
    | "person"
    | "placeholder"
  >;
};

export type EdgeMapping = {
  entity: Extract<
    IdentityEntityKind,
    | "sectionCourse"
    | "sectionAdminClass"
    | "examBatchEdge"
    | "departmentEdge"
    | "buildingCampus"
    | "sectionCampus"
    | "sectionTeacher"
    | "implicitSectionTeacher"
    | "teacherAssignmentTeacher"
    | "scheduleTeacher"
    | "teacherAssignmentTitle"
  >;
  ownerId: number;
  targetJwId: number;
  ownerType?: "section" | "teacher";
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
    retainedDepartmentPlaceholders: number;
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
