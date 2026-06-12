import {
  sectionTeachersLabel as buildSectionTeachersLabel,
  teacherName as buildTeacherName,
  formatMessage as formatSectionMessage,
  primaryName as sectionPrimaryName,
  secondaryName as sectionSecondaryName,
} from "./display";
import {
  dateTimeInputValue,
  type HomeworkAuditLog,
  type SectionDetailPageData,
  sectionSemesterWeekLabel,
} from "./section-detail-controller-helpers";
import {
  sectionHomeworkAuditActionLabel,
  sectionHomeworkAuditActorName,
  sectionYesNoLabel,
} from "./section-detail-display-adapters";

type SectionCopy = SectionDetailPageData["copy"]["sectionDetail"];
type HomeworkCopy = SectionDetailPageData["copy"]["homeworks"];
type CommonCopy = SectionDetailPageData["copy"]["common"];

export function createSectionDetailDisplayActions(input: {
  getCommonCopy: () => CommonCopy;
  getHomeworkCopy: () => HomeworkCopy;
  getNotAvailable: () => string;
  getSection: () => SectionDetailPageData["section"];
  getSectionCopy: () => SectionCopy;
}) {
  function formatMessage(
    template: string,
    values: Record<string, number | string>,
  ) {
    return formatSectionMessage(
      template,
      Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, String(value)]),
      ),
    );
  }

  function semesterWeekLabel(weekStart: Date) {
    const section = input.getSection();
    return sectionSemesterWeekLabel({
      formatMessage,
      semesterEnd: section.semester?.endDate,
      semesterStart: section.semester?.startDate,
      weekStart,
      weekTemplate: input.getSectionCopy().weekNumber,
    });
  }

  function teacherName(teacher: {
    namePrimary?: string | null;
    nameSecondary?: string | null;
    nameCn?: string | null;
    nameEn?: string | null;
  }) {
    return buildTeacherName(teacher);
  }

  return {
    auditActionLabel(action: string) {
      return sectionHomeworkAuditActionLabel(action, input.getHomeworkCopy());
    },
    auditActorName(log: HomeworkAuditLog) {
      return sectionHomeworkAuditActorName(log, input.getCommonCopy().unknown);
    },
    dateTimeInputValue(value: string | Date | null | undefined) {
      return dateTimeInputValue(value);
    },
    formatMessage,
    primaryName: sectionPrimaryName,
    secondaryName: sectionSecondaryName,
    sectionTeachersLabel(section: {
      teachers?: Array<{
        namePrimary?: string | null;
        nameSecondary?: string | null;
        nameCn?: string | null;
        nameEn?: string | null;
      }>;
    }) {
      return buildSectionTeachersLabel(
        { teachers: section.teachers ?? [] },
        input.getSectionCopy().noTeacher,
      );
    },
    semesterWeekLabel,
    teacherName,
    yesNo(value: boolean | null | undefined) {
      const sectionCopy = input.getSectionCopy();
      return sectionYesNoLabel(value, {
        fallback: input.getNotAvailable(),
        no: sectionCopy.no,
        yes: sectionCopy.yes,
      });
    },
  };
}
