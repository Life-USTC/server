import { getViewerContext } from "@/lib/auth/viewer-context";
import {
  type DescriptionTargetType,
  resolveDescriptionTarget,
} from "./description-targets";

type DescriptionUpsertError =
  | "forbidden"
  | "invalid_target"
  | "not_found"
  | "suspended";

export async function upsertDescriptionContent({
  content,
  targetId,
  targetType,
  userId,
}: {
  content: string;
  targetId: number | string;
  targetType: DescriptionTargetType;
  userId: string;
}) {
  const viewer = await getViewerContext({ userId });
  if (!viewer.isAuthenticated) {
    return { ok: false as const, error: "forbidden" as DescriptionUpsertError };
  }
  if (viewer.isSuspended) {
    return { ok: false as const, error: "suspended" as DescriptionUpsertError };
  }

  const target = resolveDescriptionTarget(targetType, targetId);
  if (!target) {
    return {
      ok: false as const,
      error: "invalid_target" as DescriptionUpsertError,
    };
  }
  const existingTarget = await target.ensureExists();
  if (!existingTarget) {
    return { ok: false as const, error: "not_found" as DescriptionUpsertError };
  }

  const { prisma } = await import("@/lib/db/prisma");
  const result = await prisma.$transaction(async (tx) => {
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

  return { ok: true as const, ...result };
}
