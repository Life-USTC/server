/** Shared static-import config and report types. */
import type { SectionPresenceStats } from "./section-lifecycle";

export type ImportConfig = {
  snapshotPath: string;
  snapshotSha256: string;
  minSemester: number;
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
  plannedRecordCounts: ImportRecordCounts | null;
  databaseRecordCounts: ImportRecordCounts | null;
  reconciliation: {
    sectionPresence: SectionPresenceStats | { status: "already-applied" };
  };
};
