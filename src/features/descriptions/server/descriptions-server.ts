import {
  type DescriptionTargetType,
  resolveDescriptionTarget,
} from "@/features/descriptions/server/description-targets";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import {
  type DescriptionPayload,
  emptyDescriptionPayload,
  serializeDescriptionHistory,
  serializeDescriptionRecord,
  type ViewerSummary,
} from "./description-payload";

type ResolvedDescriptionTarget = NonNullable<
  ReturnType<typeof resolveDescriptionTarget>
>;

export async function getDescriptionPayload(
  targetType: DescriptionTargetType,
  targetId: number | string,
  viewerOverride?: ViewerSummary,
): Promise<DescriptionPayload> {
  const target = resolveDescriptionTarget(targetType, targetId);
  const viewer =
    viewerOverride ?? (await getViewerContext({ includeAdmin: false }));

  if (!target) {
    return emptyDescriptionPayload(viewer);
  }

  return getResolvedDescriptionPayload(target, viewer);
}

export async function getResolvedDescriptionPayload(
  target: ResolvedDescriptionTarget,
  viewerOverride?: ViewerSummary,
): Promise<DescriptionPayload> {
  const viewer =
    viewerOverride ?? (await getViewerContext({ includeAdmin: false }));

  const description = await prisma.description.findFirst({
    where: target.where,
    include: {
      lastEditedBy: {
        select: { id: true, name: true, image: true, username: true },
      },
    },
  });

  const history = description
    ? await prisma.descriptionEdit.findMany({
        where: { descriptionId: description.id },
        include: {
          editor: {
            select: { id: true, name: true, image: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return {
    description: serializeDescriptionRecord(description),
    history: serializeDescriptionHistory(history),
    viewer,
  };
}
