import { jsonResponse, notFound } from "@/lib/api/helpers";

export async function updateHomeworkCompletionAction(input: {
  completed: boolean;
  homeworkId: string;
  userId: string;
}) {
  const { prisma } = await import("@/lib/db/prisma");
  const homework = await prisma.homework.findUnique({
    where: { id: input.homeworkId },
    select: { id: true, deletedAt: true },
  });

  if (!homework || homework.deletedAt) {
    return notFound();
  }

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

    return jsonResponse({
      completed: true,
      completedAt: completion.completedAt,
    });
  }

  await prisma.homeworkCompletion.deleteMany({
    where: { userId: input.userId, homeworkId: input.homeworkId },
  });

  return jsonResponse({ completed: false, completedAt: null });
}
