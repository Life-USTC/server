import type { CommentTargetOption } from "@/features/comments/lib/comment-ui";
import type {
  HomeworkAuditLog,
  HomeworkViewer,
  SectionDetailPageData,
  SectionHomework,
} from "./section-detail-controller-helpers";

type SectionDetailCopy = SectionDetailPageData["copy"];
type SectionDetailSection = SectionDetailPageData["section"];

export function buildSectionDetailTabs(
  sectionCopy: SectionDetailCopy["sectionDetail"],
) {
  return [
    ["calendar", sectionCopy.tabs.calendar],
    ["homework", sectionCopy.tabs.homeworks],
    ["comments", sectionCopy.tabs.comments],
  ] as const;
}

export function buildSectionDetailCommentTargets(
  copy: SectionDetailCopy,
  section: SectionDetailSection,
): CommentTargetOption[] {
  const firstCommentTeacher = section.teachers[0] ?? null;
  return [
    {
      key: "section",
      label: copy.sectionDetail.sectionComments,
      targetId: section.id,
      type: "section" as const,
    },
    {
      key: "course",
      label: copy.sectionDetail.courseComments,
      targetId: section.course.id,
      type: "course" as const,
    },
    ...(firstCommentTeacher
      ? [
          {
            key: "section-teacher",
            label: copy.comments.tabSectionTeacher,
            sectionId: section.id,
            teacherId:
              typeof firstCommentTeacher.id === "number"
                ? firstCommentTeacher.id
                : Number(firstCommentTeacher.id),
            type: "section-teacher" as const,
          },
        ]
      : []),
  ];
}

export function buildSectionPeriodDetailRows(
  sectionCopy: SectionDetailCopy["sectionDetail"],
  section: SectionDetailSection,
): Array<[string, number]> {
  return [
    [sectionCopy.theoryPeriods, section.theoryPeriods],
    [sectionCopy.practicePeriods, section.practicePeriods],
    [sectionCopy.experimentPeriods, section.experimentPeriods],
    [sectionCopy.machinePeriods, section.machinePeriods],
    [sectionCopy.designPeriods, section.designPeriods],
    [sectionCopy.testPeriods, section.testPeriods],
  ].filter(
    (row): row is [string, number] => typeof row[1] === "number" && row[1] > 0,
  );
}

export function buildCalendarDateKeySet<T>(
  items: T[],
  getDate: (item: T) => string | Date | null | undefined,
  dateKey: (value: string | Date | null | undefined) => string | null,
) {
  return new Set(
    items
      .map((item) => dateKey(getDate(item)))
      .filter((key): key is string => Boolean(key)),
  );
}

export function canWriteSectionHomework(viewer: HomeworkViewer) {
  return viewer.isAuthenticated && !viewer.isSuspended;
}

export function canManageSectionHomework(
  viewer: HomeworkViewer,
  homework: SectionHomework | null,
) {
  return (
    canWriteSectionHomework(viewer) &&
    Boolean(
      homework && (viewer.isAdmin || homework.createdById === viewer.userId),
    )
  );
}

export function sectionHomeworkStatus(
  homework: SectionHomework,
  homeworkCopy: SectionDetailCopy["homeworks"],
) {
  return homework.completion
    ? homeworkCopy.completedLabel
    : homeworkCopy.tagDefault;
}

export function sectionHomeworkAuditLogs(
  logs: HomeworkAuditLog[],
  homeworkId: string,
) {
  return logs.filter((log) => log.homeworkId === homeworkId);
}
