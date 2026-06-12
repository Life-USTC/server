import { toLoadData } from "@/lib/page-data-utils";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

type DateInput = Date | string | null;

type SectionPageSchedule = {
  date: DateInput;
};

type SectionPageExam = {
  examDate: DateInput;
};

type SectionPageSource = {
  schedules: SectionPageSchedule[];
  exams: SectionPageExam[];
};

export function buildSectionPageLoadData<
  Section extends SectionPageSource,
  RelatedData extends Record<string, unknown>,
>(section: Section, relatedData: RelatedData) {
  return toLoadData({
    ...section,
    schedules: section.schedules.map((schedule) => ({
      ...schedule,
      date: schedule.date ? toShanghaiIsoString(schedule.date) : null,
    })),
    exams: section.exams.map((exam) => ({
      ...exam,
      examDate: exam.examDate ? toShanghaiIsoString(exam.examDate) : null,
    })),
    ...relatedData,
  });
}
