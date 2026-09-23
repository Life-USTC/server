import type {
  DescriptionData,
  DescriptionPayload,
  DescriptionViewer,
} from "./description-payload-types";

export function emptyDescriptionData(): DescriptionData {
  return {
    id: null,
    content: "",
    renderedHtml: "",
    updatedAt: null,
    lastEditedAt: null,
    lastEditedBy: null,
  };
}

export function emptyDescriptionPayload(
  viewer: DescriptionViewer,
): DescriptionPayload {
  return {
    description: emptyDescriptionData(),
    history: [],
    viewer,
  };
}
