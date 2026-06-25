import { apiClient } from "@/lib/api/client";

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
  const result = await apiClient.GET<{
    auditLogs: AuditLog[];
    homeworks: Homework[];
    viewer: Viewer;
  }>("/api/homeworks", { params: { query: { sectionId } } });
  if (!result.response.ok || !result.data) throw new Error(errorMessage);
  return result.data;
}

export async function createSectionHomework(
  sectionId: number | string,
  input: SectionHomeworkRequest,
) {
  const result = await apiClient.POST("/api/homeworks", {
    body: {
      sectionId,
      title: input.title,
      description: input.description,
      publishedAt: input.publishedAt || null,
      submissionStartAt: input.submissionStartAt || null,
      submissionDueAt: input.submissionDueAt || null,
      isMajor: input.isMajor,
      requiresTeam: input.requiresTeam,
    },
  });
  return result.response.ok;
}

export async function updateSectionHomework(
  homeworkId: number | string,
  input: SectionHomeworkRequest,
): Promise<SectionHomeworkUpdateResult> {
  const result = await apiClient.PATCH(`/api/homeworks/${homeworkId}`, {
    body: {
      title: input.title,
      description: input.description,
      publishedAt: input.publishedAt || null,
      submissionStartAt: input.submissionStartAt || null,
      submissionDueAt: input.submissionDueAt || null,
      isMajor: input.isMajor,
      requiresTeam: input.requiresTeam,
    },
  });
  return result.response.ok ? "ok" : "homework-error";
}

export async function deleteSectionHomework(homeworkId: number | string) {
  const result = await apiClient.DELETE(`/api/homeworks/${homeworkId}`);
  return result.response.ok;
}
