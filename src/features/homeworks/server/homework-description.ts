import { writeDescriptionContentInTransaction } from "@/features/descriptions/server/description-upsert";
import type { Prisma } from "@/generated/prisma/client";

type UpdateHomeworkDescriptionOptions = {
  description?: string | null;
  homeworkId: string;
  userId: string;
};

export async function updateHomeworkDescription(
  tx: Prisma.TransactionClient,
  { description, homeworkId, userId }: UpdateHomeworkDescriptionOptions,
) {
  if (description === undefined) {
    return;
  }

  const trimmedDescription = (description ?? "").trim();
  if (!trimmedDescription && !(await hasHomeworkDescription(tx, homeworkId))) {
    return;
  }

  await writeDescriptionContentInTransaction(tx, {
    content: trimmedDescription,
    targetType: "homework",
    userId,
    where: { homeworkId },
  });
}

async function hasHomeworkDescription(
  tx: Prisma.TransactionClient,
  homeworkId: string,
) {
  const existingDescription = await tx.description.findFirst({
    where: { homeworkId },
    select: { id: true },
  });
  return Boolean(existingDescription);
}
