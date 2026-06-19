type DescriptionTarget = {
  where: Record<string, number | string>;
};

export async function upsertDescriptionContent({
  content,
  target,
  userId,
}: {
  content: string;
  target: DescriptionTarget;
  userId: string;
}) {
  const { prisma } = await import("@/lib/db/prisma");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.description.findFirst({
      where: target.where,
    });
    if (existing && existing.content === content) {
      return { id: existing.id, updated: false };
    }

    const description = existing
      ? await tx.description.update({
          where: { id: existing.id },
          data: {
            content,
            lastEditedAt: new Date(),
            lastEditedById: userId,
          },
        })
      : await tx.description.create({
          data: {
            content,
            lastEditedAt: new Date(),
            lastEditedById: userId,
            ...target.where,
          },
        });

    await tx.descriptionEdit.create({
      data: {
        descriptionId: description.id,
        editorId: userId,
        previousContent: existing?.content ?? null,
        nextContent: content,
      },
    });

    return { id: description.id, updated: true };
  });
}
