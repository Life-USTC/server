import { fireAuditLog } from "@/lib/audit/write-audit-log";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import { isPrismaUniqueConstraintError } from "@/lib/db/prisma-errors";
import {
  type DescriptionTargetType,
  resolveDescriptionTarget,
} from "./description-targets";

type DescriptionUpsertError =
  | "forbidden"
  | "invalid_target"
  | "not_found"
  | "suspended";

type DescriptionEditAuditMetadata = {
  ipAddress?: string;
  source?: string;
  userAgent?: string;
};

export async function upsertDescriptionContent({
  auditMetadata,
  content,
  targetId,
  targetType,
  userId,
}: {
  auditMetadata?: DescriptionEditAuditMetadata;
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
    return {
      ok: false as const,
      error: "suspended" as DescriptionUpsertError,
      reason: viewer.suspensionReason,
    };
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

  const writeDescription = () =>
    prisma.$transaction(async (tx) => {
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

  let result: Awaited<ReturnType<typeof writeDescription>>;
  try {
    result = await writeDescription();
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error;
    result = await writeDescription();
  }

  if (result.updated) {
    await writeDescriptionEditAuditLog({
      content,
      descriptionId: result.id,
      metadata: auditMetadata,
      targetType,
      userId,
    });
  }

  return { ok: true as const, ...result };
}

async function writeDescriptionEditAuditLog({
  content,
  descriptionId,
  metadata,
  targetType,
  userId,
}: {
  content: string;
  descriptionId: string;
  metadata?: DescriptionEditAuditMetadata;
  targetType: DescriptionTargetType;
  userId: string;
}) {
  const { source, ...requestMetadata } = metadata ?? {};
  await fireAuditLog({
    action: "description_edit",
    userId,
    targetId: descriptionId,
    targetType: "description",
    metadata: {
      targetType,
      content: content.slice(0, 200),
      ...(source ? { source } : {}),
    },
    ...requestMetadata,
  });
}
