import { emptyDescriptionPayload } from "@/features/descriptions/server/description-payload";
import { getDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import type { ViewerContext } from "@/lib/auth/viewer-context";

export async function loadCatalogDetailCommentsData({
  includeDescription,
  includeDescriptionHistory,
  targetId,
  type,
  viewer,
}: {
  includeDescription: boolean;
  includeDescriptionHistory: boolean;
  targetId: number;
  type: "course" | "teacher";
  viewer: ViewerContext;
}) {
  const descriptionData = includeDescription
    ? await getDescriptionPayload(type, targetId, viewer, {
        includeHistory: includeDescriptionHistory,
      })
    : emptyDescriptionPayload(viewer);

  return {
    commentsData: null,
    descriptionData,
  };
}
