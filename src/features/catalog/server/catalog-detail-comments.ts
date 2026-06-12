import { getCommentsPayload } from "@/features/comments/server/comments-server";
import { getDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import type { ViewerContext } from "@/lib/auth/viewer-context";

export async function loadCatalogDetailCommentsData({
  targetId,
  type,
  viewer,
}: {
  targetId: number;
  type: "course" | "teacher";
  viewer: ViewerContext;
}) {
  const [descriptionData, comments] = await Promise.all([
    getDescriptionPayload(type, targetId, viewer),
    getCommentsPayload({ type, targetId }, viewer),
  ]);

  return {
    commentsData: {
      commentMap: { [type]: comments.comments },
      hiddenCount: comments.hiddenCount,
      viewer,
    },
    descriptionData,
  };
}
