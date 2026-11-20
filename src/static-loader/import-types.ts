/** Shared static-import config and report types. */
import type { upsertOfficialProfiles } from "./catalog-profile-writes";
import type { replaceRelatedCatalog } from "./catalog-related";
import type { SectionPresenceStats } from "./section-lifecycle";

export type ImportConfig = {
  snapshotPath: string;
  snapshotSha256: string;
  dryRun: boolean;
};

export type ImportRecordCounts = {
  semesters: number;
  departments: number;
  courses: number;
  sections: number;
  teachers: number;
  scheduleGroups: number;
  schedules: number;
  exams: number;
  rooms: number;
  buildings: number;
  campuses: number;
  adminClasses: number;
  youngEvents: number;
};

export type ImportReport = {
  mode: "apply" | "dry-run";
  outcome: "committed" | "rolled-back" | "unchanged";
  snapshot: {
    sha256: string;
    schemaVersion: string;
    generatedAt: string | null;
  };
  sourceAvailability: {
    unavailableCurriculumSemesterJwIds: number[];
    unavailableExamSemesterJwIds: number[];
  };
  plannedRecordCounts: ImportRecordCounts | null;
  databaseRecordCounts: ImportRecordCounts | null;
  reconciliation: {
    officialProfiles?: Awaited<ReturnType<typeof upsertOfficialProfiles>>;
    officialRelationships?: Awaited<ReturnType<typeof replaceRelatedCatalog>>;
    sectionPresence: SectionPresenceStats | { status: "already-applied" };
  };
};
