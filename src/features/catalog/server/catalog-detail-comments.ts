import { getCommentsPayload } from "@/features/comments/server/comments-server";
import { emptyDescriptionPayload } from "@/features/descriptions/server/description-payload";
import { getDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import type { ViewerContext } from "@/lib/auth/viewer-context";

export async function loadCatalogDetailCommentsData({
  includeComments,
  includeDescription,
  includeDescriptionHistory,
  targetId,
  type,
  viewer,
}: {
  includeComments: boolean;
  includeDescription: boolean;
  includeDescriptionHistory: boolean;
  targetId: number;
  type: "course" | "teacher";
  viewer: ViewerContext;
}) {
  const [descriptionData, comments] = await Promise.all([
    includeDescription
      ? getDescriptionPayload(type, targetId, viewer, {
          includeHistory: includeDescriptionHistory,
        })
      : Promise.resolve(emptyDescriptionPayload(viewer)),
    includeComments
      ? getCommentsPayload({ type, targetId }, viewer, { pageSize: 20 })
      : Promise.resolve(null),
  ]);

  return {
    commentsData: comments
      ? {
          commentMap: { [type]: comments.comments },
          complete: comments.complete,
          hiddenCount: comments.hiddenCount,
          viewer,
        }
      : null,
    descriptionData,
  };
}
