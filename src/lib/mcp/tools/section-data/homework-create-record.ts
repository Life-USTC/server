import { createHomeworkForSection } from "@/features/homeworks/server/homework-create";

export async function createHomeworkOnSectionRecord(input: {
  description?: string | null;
  isMajor?: boolean;
  publishedAt: Date | null;
  requiresTeam?: boolean;
  sectionId: number;
  submissionDueAt: Date | null;
  submissionStartAt: Date | null;
  title: string;
  userId: string;
}) {
  const trimmedDescription = (input.description ?? "").trim();

  const created = await createHomeworkForSection(input.userId, {
    description: trimmedDescription || null,
    isMajor: input.isMajor === true,
    publishedAt: input.publishedAt,
    requiresTeam: input.requiresTeam === true,
    sectionId: input.sectionId,
    submissionDueAt: input.submissionDueAt,
    submissionStartAt: input.submissionStartAt,
    title: input.title,
  });

  if (!created) {
    throw new Error("Resolved section was not found while creating homework");
  }

  return created;
}
