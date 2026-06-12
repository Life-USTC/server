export type SectionHomeworkRequest = {
  description: string;
  isMajor: boolean;
  publishedAt: string | null;
  requiresTeam: boolean;
  submissionDueAt: string | null;
  submissionStartAt: string | null;
  title: string;
};

export type HomeworkCompletionResult = {
  completed: boolean;
  completedAt: string | null;
};

export type SectionHomeworkUpdateResult =
  | "ok"
  | "homework-error"
  | "description-error";

export async function loadSectionHomeworks<Viewer, Homework, AuditLog>(
  sectionId: number | string,
  errorMessage: string,
) {
  const response = await fetch(`/api/homeworks?sectionId=${sectionId}`);
  if (!response.ok) throw new Error(errorMessage);
  return (await response.json()) as {
    auditLogs: AuditLog[];
    homeworks: Homework[];
    viewer: Viewer;
  };
}

export async function createSectionHomework(
  sectionId: number | string,
  input: SectionHomeworkRequest,
) {
  const response = await fetch("/api/homeworks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sectionId,
      title: input.title,
      description: input.description,
      publishedAt: input.publishedAt || null,
      submissionStartAt: input.submissionStartAt || null,
      submissionDueAt: input.submissionDueAt || null,
      isMajor: input.isMajor,
      requiresTeam: input.requiresTeam,
    }),
  });
  return response.ok;
}

export async function updateSectionHomework(
  homeworkId: number | string,
  input: SectionHomeworkRequest,
): Promise<SectionHomeworkUpdateResult> {
  const response = await fetch(`/api/homeworks/${homeworkId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      publishedAt: input.publishedAt || null,
      submissionStartAt: input.submissionStartAt || null,
      submissionDueAt: input.submissionDueAt || null,
      isMajor: input.isMajor,
      requiresTeam: input.requiresTeam,
    }),
  });
  if (!response.ok) return "homework-error";

  const descriptionResponse = await fetch("/api/descriptions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      targetType: "homework",
      targetId: homeworkId,
      content: input.description,
    }),
  });
  return descriptionResponse.ok ? "ok" : "description-error";
}

export async function updateSectionHomeworkCompletion(
  homeworkId: number | string,
  completed: boolean,
): Promise<HomeworkCompletionResult | null> {
  const response = await fetch(`/api/homeworks/${homeworkId}/completion`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  if (!response.ok) return null;
  return (await response.json()) as HomeworkCompletionResult;
}

export async function deleteSectionHomework(homeworkId: number | string) {
  const response = await fetch(`/api/homeworks/${homeworkId}`, {
    method: "DELETE",
  });
  return response.ok;
}
