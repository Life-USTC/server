import type { SectionDetailPageData } from "./section-detail-controller-helpers";

export type SectionDetailCopy = SectionDetailPageData["copy"]["sectionDetail"];
export type SectionDetailSection = SectionDetailPageData["section"];
export type ScheduleItem = SectionDetailSection["schedules"][number];
export type ExamItem = SectionDetailSection["exams"][number];
