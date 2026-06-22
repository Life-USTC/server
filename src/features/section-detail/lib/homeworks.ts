export type SectionHomeworkRequest = {
  description: string;
  isMajor: boolean;
  publishedAt: string | null;
  requiresTeam: boolean;
  submissionDueAt: string | null;
  submissionStartAt: string | null;
  title: string;
};

export type SectionHomeworkUpdateResult = "ok" | "homework-error";

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
      description: input.description,
      publishedAt: input.publishedAt || null,
      submissionStartAt: input.submissionStartAt || null,
      submissionDueAt: input.submissionDueAt || null,
      isMajor: input.isMajor,
      requiresTeam: input.requiresTeam,
    }),
  });
  return response.ok ? "ok" : "homework-error";
}

export async function deleteSectionHomework(homeworkId: number | string) {
  const response = await fetch(`/api/homeworks/${homeworkId}`, {
    method: "DELETE",
  });
  return response.ok;
}
