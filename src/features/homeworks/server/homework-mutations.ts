import { scheduleInvalidateCalendarExportsForSection } from "@/features/calendar/server/calendar-export-invalidation";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { prisma } from "@/lib/db/prisma";
import { isPrismaUniqueConstraintError } from "@/lib/db/prisma-errors";
import {
  type HomeworkAuditContext,
  homeworkAuditAttribution,
} from "./homework-audit";
import { updateHomeworkDescription } from "./homework-description";
import {
  type HomeworkUpdateIntent,
  hasHomeworkUpdateIntentChanges,
  homeworkUpdateChangedFields,
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
  audit?: HomeworkAuditContext;
}) {
  const writer = await requireActiveHomeworkWriter(input.userId);
  if (!writer.ok) return writer;

  const homework = await prisma.homework.findUnique({
    where: { id: input.homeworkId },
    select: { id: true, deletedAt: true, sectionId: true },
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

  const writeHomeworkUpdate = () =>
    prisma.$transaction(async (tx) => {
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

      await writeAuditLog(
        {
          action: "homework_update",
          ...homeworkAuditAttribution(input.userId, input.audit),
          targetId: input.homeworkId,
          targetType: "homework",
          metadata: {
            sectionId: homework.sectionId,
            changedFields: homeworkUpdateChangedFields(input.update),
          },
        },
        tx,
      );
    });

  try {
    await writeHomeworkUpdate();
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error;
    await writeHomeworkUpdate();
  }

  scheduleInvalidateCalendarExportsForSection(homework.sectionId);

  return { ok: true as const };
}

export async function deleteHomework(input: {
  audit?: HomeworkAuditContext;
  homeworkId: string;
  userId: string;
}) {
  const [viewer, homework] = await Promise.all([
    requireActiveHomeworkWriter(input.userId),
    prisma.homework.findUnique({
      where: { id: input.homeworkId },
      select: {
        id: true,
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

    await writeAuditLog(
      {
        action: "homework_delete",
        ...homeworkAuditAttribution(input.userId, input.audit),
        targetId: homework.id,
        targetType: "homework",
        metadata: { sectionId: homework.sectionId },
      },
      tx,
    );
  });

  scheduleInvalidateCalendarExportsForSection(homework.sectionId);

  return { ok: true as const, alreadyDeleted: false };
}
