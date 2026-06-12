import { withHomeworkItemState } from "@/features/homeworks/server/homework-item-state";
import { getPrisma } from "@/lib/db/prisma";
import { jsonToolResult } from "@/lib/mcp/tools/_helpers";

const homeworkToolUserSelect = {
  select: { id: true, name: true, username: true, image: true },
} as const;

export function buildHomeworkToolInclude(userId?: string | null) {
  return {
    section: {
      include: {
        course: true,
        semester: true,
      },
    },
    description: true,
    createdBy: homeworkToolUserSelect,
    updatedBy: homeworkToolUserSelect,
    deletedBy: homeworkToolUserSelect,
    ...(userId
      ? {
          homeworkCompletions: {
            where: { userId },
            select: { completedAt: true },
          },
        }
      : {}),
  } as const;
}

export async function getHomeworkItemById(
  homeworkId: string,
  locale: string,
  userId?: string | null,
) {
  const homework = await getPrisma(locale).homework.findUnique({
    where: { id: homeworkId },
    include: buildHomeworkToolInclude(userId),
  });
  if (!homework) {
    return null;
  }

  const [homeworkItem] = await withHomeworkItemState([homework]);
  return homeworkItem ?? null;
}

export function invalidSubmissionWindow(
  submissionStartAt: Date | null | undefined,
  submissionDueAt: Date | null | undefined,
) {
  if (
    submissionStartAt &&
    submissionDueAt &&
    submissionStartAt.getTime() > submissionDueAt.getTime()
  ) {
    return jsonToolResult(
      { success: false, message: "Submission start must be before due" },
      { mode: "default" },
    );
  }

  return null;
}
