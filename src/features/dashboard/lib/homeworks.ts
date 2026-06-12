export type HomeworkCompletionResult = {
  completed: boolean;
  completedAt: string | null;
};

type HomeworkCompletionState = {
  completion?: unknown | null;
};

type HomeworkSectionLabel = {
  code?: string | null;
  courseName?: string | null;
  semesterName?: string | null;
};

type HomeworkWithSection = {
  id: number | string;
  section?: {
    code?: string | null;
    courseName?: string | null;
    jwId?: number | null;
    semesterName?: string | null;
  } | null;
};

export function homeworkStatusLabel(
  homework: HomeworkCompletionState,
  labels: {
    completed: string;
    pending: string;
  },
) {
  return homework.completion ? labels.completed : labels.pending;
}

export function homeworkSectionOptionLabel(
  section: HomeworkSectionLabel,
  fallback: string,
) {
  return (
    [section.courseName ?? fallback, section.code, section.semesterName]
      .filter(Boolean)
      .join(" · ") || fallback
  );
}

export function homeworkDetailHref(
  homework: HomeworkWithSection,
  fallbackHref: string,
) {
  return homework.section?.jwId
    ? `/sections/${homework.section.jwId}#homework-${homework.id}`
    : fallbackHref;
}

export function homeworkSectionHref(
  homework: HomeworkWithSection,
  fallbackHref: string,
) {
  return homework.section?.jwId
    ? `/sections/${homework.section.jwId}`
    : fallbackHref;
}

export function homeworkCourseLabel(
  homework: HomeworkWithSection,
  fallback: string,
) {
  const section = homework.section;
  return (
    [section?.courseName, section?.code, section?.semesterName]
      .filter((part): part is string => Boolean(part))
      .join(" · ") || fallback
  );
}

export function homeworkCompletionActionLabel(
  homework: HomeworkCompletionState,
  labels: {
    markComplete: string;
    markIncomplete: string;
  },
) {
  return homework.completion ? labels.markIncomplete : labels.markComplete;
}

export async function updateHomeworkCompletion(input: {
  completed: boolean;
  errorMessage: string;
  homeworkId: number | string;
}): Promise<HomeworkCompletionResult> {
  const response = await fetch(
    `/api/homeworks/${input.homeworkId}/completion`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: input.completed }),
    },
  );
  if (!response.ok) throw new Error(input.errorMessage);
  return (await response.json()) as HomeworkCompletionResult;
}
