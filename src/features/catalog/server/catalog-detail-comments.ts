import { getCommentsPayload } from "@/features/comments/server/comments-server";
import { getDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import type { ViewerContext } from "@/lib/auth/viewer-context";

export async function loadCatalogDetailCommentsData({
  includeComments,
  targetId,
  type,
  viewer,
}: {
  includeComments: boolean;
  targetId: number;
  type: "course" | "teacher";
  viewer: ViewerContext;
}) {
  const [descriptionData, comments] = await Promise.all([
    getDescriptionPayload(type, targetId, viewer),
    includeComments
      ? getCommentsPayload({ type, targetId }, viewer)
      : Promise.resolve(null),
  ]);

  return {
    commentsData: comments
      ? {
          commentMap: { [type]: comments.comments },
          hiddenCount: comments.hiddenCount,
          viewer,
        }
      : null,
    descriptionData,
  };
}
