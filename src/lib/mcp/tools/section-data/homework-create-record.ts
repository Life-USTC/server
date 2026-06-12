import { prisma } from "@/lib/db/prisma";

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

  return prisma.$transaction(async (tx) => {
    const created = await tx.homework.create({
      data: {
        sectionId: input.sectionId,
        title: input.title,
        isMajor: input.isMajor === true,
        requiresTeam: input.requiresTeam === true,
        publishedAt: input.publishedAt,
        submissionStartAt: input.submissionStartAt,
        submissionDueAt: input.submissionDueAt,
        createdById: input.userId,
        updatedById: input.userId,
      },
    });

    if (trimmedDescription) {
      const descriptionRecord = await tx.description.create({
        data: {
          content: trimmedDescription,
          lastEditedAt: new Date(),
          lastEditedById: input.userId,
          homeworkId: created.id,
        },
      });
      await tx.descriptionEdit.create({
        data: {
          descriptionId: descriptionRecord.id,
          editorId: input.userId,
          previousContent: null,
          nextContent: trimmedDescription,
        },
      });
    }

    await tx.homeworkAuditLog.create({
      data: {
        action: "created",
        sectionId: input.sectionId,
        homeworkId: created.id,
        actorId: input.userId,
        titleSnapshot: input.title,
      },
    });

    return created;
  });
}
