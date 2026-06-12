import type { HomeworkCompletionResult } from "./homeworks";
import type { SectionHomework } from "./section-detail-controller-helpers";

export function applySectionHomeworkCompletion(input: {
  homeworks: SectionHomework[];
  homeworkId: string | number;
  result: HomeworkCompletionResult;
  selectedHomework: SectionHomework | null;
}) {
  const homeworks = input.homeworks.map((item) =>
    item.id === input.homeworkId
      ? {
          ...item,
          completion: input.result.completed
            ? { completedAt: input.result.completedAt }
            : null,
        }
      : item,
  );

  return {
    homeworks,
    selectedHomework:
      input.selectedHomework?.id === input.homeworkId
        ? (homeworks.find((item) => item.id === input.homeworkId) ?? null)
        : input.selectedHomework,
  };
}

export function removeSectionHomework(input: {
  deletedId: string | number;
  homeworks: SectionHomework[];
  selectedHomework: SectionHomework | null;
}) {
  return {
    homeworks: input.homeworks.filter((item) => item.id !== input.deletedId),
    selectedHomework:
      input.selectedHomework?.id === input.deletedId
        ? null
        : input.selectedHomework,
  };
}
