import { prisma } from "@/lib/db/prisma";

export type CreateHomeworkInput = {
  description?: string | null;
  isMajor: boolean;
  publishedAt?: Date | null;
  requiresTeam: boolean;
  sectionId: number;
  submissionDueAt?: Date | null;
  submissionStartAt?: Date | null;
  title: string;
};

export async function resolveSectionIdForHomeworkCreate(input: {
  sectionId: number | null;
  sectionJwId: number | null;
}) {
  if (input.sectionJwId == null) {
    return input.sectionId;
  }

  const section = await prisma.section.findUnique({
    where: { jwId: input.sectionJwId },
    select: { id: true },
  });
  if (!section) {
    return null;
  }
  if (input.sectionId != null && input.sectionId !== section.id) {
    return null;
  }

  return section.id;
}

export async function createHomeworkForSection(
  userId: string,
  homeworkInput: CreateHomeworkInput,
) {
  const section = await prisma.section.findUnique({
    where: { id: homeworkInput.sectionId },
    select: { id: true },
  });

  if (!section) return null;

  return prisma.$transaction(async (tx) => {
    const homework = await tx.homework.create({
      data: {
        sectionId: homeworkInput.sectionId,
        title: homeworkInput.title,
        isMajor: homeworkInput.isMajor,
        requiresTeam: homeworkInput.requiresTeam,
        publishedAt: homeworkInput.publishedAt,
        submissionStartAt: homeworkInput.submissionStartAt,
        submissionDueAt: homeworkInput.submissionDueAt,
        createdById: userId,
        updatedById: userId,
      },
    });

    if (homeworkInput.description) {
      const descriptionRecord = await tx.description.create({
        data: {
          content: homeworkInput.description,
          lastEditedAt: new Date(),
          lastEditedById: userId,
          homeworkId: homework.id,
        },
      });

      await tx.descriptionEdit.create({
        data: {
          descriptionId: descriptionRecord.id,
          editorId: userId,
          previousContent: null,
          nextContent: homeworkInput.description,
        },
      });
    }

    await tx.homeworkAuditLog.create({
      data: {
        action: "created",
        sectionId: homeworkInput.sectionId,
        homeworkId: homework.id,
        actorId: userId,
        titleSnapshot: homeworkInput.title,
      },
    });

    return homework;
  });
}
