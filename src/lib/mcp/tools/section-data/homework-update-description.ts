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
  const existingDescription = await tx.description.findFirst({
    where: { homeworkId },
  });
  const previousContent = existingDescription?.content ?? null;
  if (!existingDescription && !trimmedDescription) {
    return;
  }
  if (
    existingDescription &&
    existingDescription.content === trimmedDescription
  ) {
    return;
  }
  const next = existingDescription
    ? await tx.description.update({
        where: { id: existingDescription.id },
        data: {
          content: trimmedDescription,
          lastEditedAt: new Date(),
          lastEditedById: userId,
        },
      })
    : await tx.description.create({
        data: {
          content: trimmedDescription,
          lastEditedAt: new Date(),
          lastEditedById: userId,
          homeworkId,
        },
      });
  await tx.descriptionEdit.create({
    data: {
      descriptionId: next.id,
      editorId: userId,
      previousContent,
      nextContent: trimmedDescription,
    },
  });
}
