import { forbidden, jsonResponse, notFound } from "@/lib/api/helpers";
import { parseUpdateHomeworkInput } from "@/lib/api/routes/homework-mutation-helpers";

export async function updateHomeworkAction(
  id: string,
  userId: string,
  parsedBody: Parameters<typeof parseUpdateHomeworkInput>[0],
) {
  const { prisma } = await import("@/lib/db/prisma");
  const homework = await prisma.homework.findUnique({
    where: { id },
    select: { id: true, deletedAt: true },
  });

  if (!homework) {
    return notFound();
  }

  if (homework.deletedAt) {
    return forbidden("Homework deleted");
  }

  const updates = parseUpdateHomeworkInput(parsedBody, userId);
  if (updates instanceof Response) return updates;

  await prisma.homework.update({
    where: { id },
    data: updates,
  });

  return jsonResponse({ success: true });
}
