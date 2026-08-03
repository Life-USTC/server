import { emptyDescriptionPayload } from "@/features/descriptions/server/description-payload";
import { getDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import { getViewerContext } from "@/lib/auth/viewer-context";

export async function getSectionDetailDescriptionAndComments(
  section: {
    id: number;
  },
  userId: string | null,
  {
    includeDescription,
    includeDescriptionHistory,
  }: {
    includeDescription: boolean;
    includeDescriptionHistory: boolean;
  },
) {
  const descriptionViewer = await getViewerContext({ userId });
  const descriptionData = includeDescription
    ? await getDescriptionPayload("section", section.id, descriptionViewer, {
        includeHistory: includeDescriptionHistory,
      })
    : emptyDescriptionPayload(descriptionViewer);

  return {
    commentsData: null,
    descriptionData,
  };
}
