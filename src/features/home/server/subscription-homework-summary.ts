import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import type {
  HomeworkSummaryItem,
  SubscribedHomeworkRecord,
} from "./subscription-homework-types";

export function homeworkSummaryFromRecord(
  hw: SubscribedHomeworkRecord,
): HomeworkSummaryItem {
  return {
    id: hw.id,
    title: hw.title,
    isMajor: hw.isMajor,
    requiresTeam: hw.requiresTeam,
    publishedAt: hw.publishedAt ? toShanghaiIsoString(hw.publishedAt) : null,
    submissionStartAt: hw.submissionStartAt
      ? toShanghaiIsoString(hw.submissionStartAt)
      : null,
    submissionDueAt: hw.submissionDueAt
      ? toShanghaiIsoString(hw.submissionDueAt)
      : null,
    createdAt: toShanghaiIsoString(hw.createdAt),
    description: hw.description?.content ?? null,
    completion: hw.homeworkCompletions[0]
      ? {
          completedAt: toShanghaiIsoString(
            hw.homeworkCompletions[0].completedAt,
          ),
        }
      : null,
    section: hw.section
      ? {
          jwId: hw.section.jwId ?? null,
          code: hw.section.code ?? null,
          courseName: hw.section.course?.namePrimary ?? null,
          semesterName: hw.section.semester?.nameCn ?? null,
        }
      : null,
  };
}
