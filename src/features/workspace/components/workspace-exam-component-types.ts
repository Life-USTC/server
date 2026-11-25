import type { ExamRow } from "@/features/workspace/lib/workspace-controller-types";
import type { workspaceTabHref } from "@/features/workspace/lib/workspace-nav";
import type { WorkspaceNamed } from "./workspace-component-types";

export type WorkspaceExamRow = ExamRow;

export type WorkspaceTabHref = typeof workspaceTabHref;

export type ExamTimeLabel = (
  startTime: number | null | undefined,
  endTime: number | null | undefined,
) => string;

export type ExamMetadataLabels = (exam: WorkspaceExamRow) => string[];

export type NamePrimary = (value?: WorkspaceNamed | null) => string;

export type WorkspaceCardView = "cards" | "list";

export type ExamDisplayRow = {
  id: WorkspaceExamRow["id"];
  href: string;
  course: string;
  section: string;
  semester: string;
  date: string;
  time: string;
  status: string;
  mode: WorkspaceExamRow["examMode"];
  metadata: string[];
  rooms: WorkspaceExamRow["rooms"];
};
