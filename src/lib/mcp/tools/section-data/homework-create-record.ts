import { createHomeworkForSection } from "@/features/homeworks/server/homework-create";

export async function createHomeworkOnSectionRecord(input: {
  description?: string | null;
  isMajor?: boolean;
  publishedAt: Date | null;
  requiresTeam?: boolean;
  sectionJwId: number;
  submissionDueAt: Date | null;
  submissionStartAt: Date | null;
  title: string;
  userId: string;
}) {
  const trimmedDescription = (input.description ?? "").trim();

  const result = await createHomeworkForSection(input.userId, {
    description: trimmedDescription || null,
    isMajor: input.isMajor === true,
    publishedAt: input.publishedAt,
    requiresTeam: input.requiresTeam === true,
    sectionJwId: input.sectionJwId,
    submissionDueAt: input.submissionDueAt,
    submissionStartAt: input.submissionStartAt,
    title: input.title,
  });

  return result;
}
