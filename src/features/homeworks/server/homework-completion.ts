import { prisma } from "@/lib/db/prisma";

export type HomeworkCompletionErrorCode = "not_found" | "deleted";

export type HomeworkCompletionResult =
  | {
      success: true;
      homeworkId: string;
      completed: boolean;
      completedAt: Date | null;
    }
  | {
      success: false;
      homeworkId: string;
      completed: boolean;
      error: {
        code: HomeworkCompletionErrorCode;
        message: string;
      };
    };

export async function setHomeworkCompletion(input: {
  completed: boolean;
  homeworkId: string;
  userId: string;
}): Promise<HomeworkCompletionResult> {
  const homework = await prisma.homework.findUnique({
    where: { id: input.homeworkId },
    select: { id: true, deletedAt: true },
  });

  if (!homework) {
    return completionFailure(input, "not_found", "Homework not found");
  }
  if (homework.deletedAt) {
    return completionFailure(input, "deleted", "Homework is deleted");
  }

  return writeHomeworkCompletion(input);
}

export async function setHomeworkCompletions(input: {
  items: Array<{ completed: boolean; homeworkId: string }>;
  userId: string;
}) {
  const homeworkIds = [...new Set(input.items.map((item) => item.homeworkId))];
  const homeworks = await prisma.homework.findMany({
    where: { id: { in: homeworkIds } },
    select: { id: true, deletedAt: true },
  });
  const homeworkById = new Map(
    homeworks.map((homework) => [homework.id, homework]),
  );

  const results: HomeworkCompletionResult[] = [];
  for (const item of input.items) {
    const completionInput = { ...item, userId: input.userId };
    const homework = homeworkById.get(item.homeworkId);
    if (!homework) {
      results.push(
        completionFailure(completionInput, "not_found", "Homework not found"),
      );
      continue;
    }
    if (homework.deletedAt) {
      results.push(
        completionFailure(completionInput, "deleted", "Homework is deleted"),
      );
      continue;
    }
    results.push(await writeHomeworkCompletion(completionInput));
  }
  return { results };
}

async function writeHomeworkCompletion(input: {
  completed: boolean;
  homeworkId: string;
  userId: string;
}): Promise<HomeworkCompletionResult> {
  if (input.completed) {
    const completion = await prisma.homeworkCompletion.upsert({
      where: {
        userId_homeworkId: {
          userId: input.userId,
          homeworkId: input.homeworkId,
        },
      },
      update: { completedAt: new Date() },
      create: { userId: input.userId, homeworkId: input.homeworkId },
    });

    return {
      success: true,
      homeworkId: input.homeworkId,
      completed: true,
      completedAt: completion.completedAt,
    };
  }

  await prisma.homeworkCompletion.deleteMany({
    where: { userId: input.userId, homeworkId: input.homeworkId },
  });

  return {
    success: true,
    homeworkId: input.homeworkId,
    completed: false,
    completedAt: null,
  };
}

function completionFailure(
  input: { completed: boolean; homeworkId: string },
  code: HomeworkCompletionErrorCode,
  message: string,
): HomeworkCompletionResult {
  return {
    success: false,
    homeworkId: input.homeworkId,
    completed: input.completed,
    error: { code, message },
  };
}
