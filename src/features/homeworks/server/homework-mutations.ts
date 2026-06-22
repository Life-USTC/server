import { prisma } from "@/lib/db/prisma";
import { updateHomeworkDescription } from "./homework-description";
import {
  type HomeworkUpdateIntent,
  hasHomeworkUpdateIntentChanges,
} from "./homework-update-intent";
import {
  type HomeworkWriteAuthError,
  requireActiveHomeworkWriter,
} from "./homework-write-auth";

type HomeworkMutationError =
  | "deleted"
  | "forbidden"
  | "no_changes"
  | "not_found"
  | HomeworkWriteAuthError;

export async function updateHomework(input: {
  homeworkId: string;
  update: HomeworkUpdateIntent;
  userId: string;
}) {
  const writer = await requireActiveHomeworkWriter(input.userId);
  if (!writer.ok) return writer;

  const homework = await prisma.homework.findUnique({
    where: { id: input.homeworkId },
    select: { id: true, deletedAt: true },
  });

  if (!homework) {
    return { ok: false as const, error: "not_found" as HomeworkMutationError };
  }

  if (homework.deletedAt) {
    return { ok: false as const, error: "deleted" as HomeworkMutationError };
  }

  if (!hasHomeworkUpdateIntentChanges(input.update)) {
    return { ok: false as const, error: "no_changes" as HomeworkMutationError };
  }

  await prisma.$transaction(async (tx) => {
    if (input.update.homeworkUpdates) {
      await tx.homework.update({
        where: { id: input.homeworkId },
        data: input.update.homeworkUpdates,
      });
    }

    await updateHomeworkDescription(tx, {
      description: input.update.description,
      homeworkId: input.homeworkId,
      userId: input.userId,
    });
  });

  return { ok: true as const };
}

export async function deleteHomework(input: {
  homeworkId: string;
  userId: string;
}) {
  const [viewer, homework] = await Promise.all([
    requireActiveHomeworkWriter(input.userId),
    prisma.homework.findUnique({
      where: { id: input.homeworkId },
      select: {
        id: true,
        title: true,
        createdById: true,
        deletedAt: true,
        sectionId: true,
      },
    }),
  ]);
  if (!viewer.ok) return viewer;

  if (!homework) {
    return { ok: false as const, error: "not_found" as HomeworkMutationError };
  }

  if (!viewer.viewer.isAdmin && homework.createdById !== input.userId) {
    return { ok: false as const, error: "forbidden" as HomeworkMutationError };
  }

  if (homework.deletedAt) {
    return { ok: true as const, alreadyDeleted: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.homework.update({
      where: { id: input.homeworkId },
      data: {
        deletedAt: new Date(),
        deletedById: input.userId,
        updatedById: input.userId,
      },
    });

    await tx.homeworkAuditLog.create({
      data: {
        action: "deleted",
        sectionId: homework.sectionId,
        homeworkId: homework.id,
        actorId: input.userId,
        titleSnapshot: homework.title,
      },
    });
  });

  return { ok: true as const, alreadyDeleted: false };
}
