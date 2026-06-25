import type {
  DescriptionData,
  DescriptionHistoryItem,
  DescriptionPayload,
  DescriptionViewer,
  EditorSummary,
} from "@/features/descriptions/lib/description-payload-types";

export type {
  DescriptionData,
  DescriptionHistoryItem,
  DescriptionPayload,
  DescriptionViewer,
  EditorSummary,
} from "@/features/descriptions/lib/description-payload-types";

import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

type DateLike = Date | string;

type DescriptionRecord = {
  content?: string | null;
  id: string;
  lastEditedAt?: DateLike | null;
  lastEditedBy?: EditorSummary | null;
  updatedAt?: DateLike | null;
};

type DescriptionHistoryRecord = {
  createdAt: DateLike;
  editor?: EditorSummary | null;
  id: string;
  nextContent?: string | null;
  previousContent?: string | null;
};

export function emptyDescriptionData(): DescriptionData {
  return {
    id: null,
    content: "",
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

export function serializeDescriptionRecord(
  description: DescriptionRecord | null | undefined,
): DescriptionData {
  if (!description) return emptyDescriptionData();

  return {
    id: description.id,
    content: description.content ?? "",
    updatedAt: description.updatedAt
      ? toShanghaiIsoString(description.updatedAt)
      : null,
    lastEditedAt: description.lastEditedAt
      ? toShanghaiIsoString(description.lastEditedAt)
      : null,
    lastEditedBy: description.lastEditedBy ?? null,
  };
}

export function serializeDescriptionHistory(
  history: DescriptionHistoryRecord[],
): DescriptionHistoryItem[] {
  return history.map((entry) => ({
    id: entry.id,
    createdAt: toShanghaiIsoString(entry.createdAt),
    previousContent: entry.previousContent ?? null,
    nextContent: entry.nextContent ?? "",
    editor: entry.editor
      ? {
          id: entry.editor.id,
          name: entry.editor.name,
          username: entry.editor.username,
          image: entry.editor.image,
        }
      : null,
  }));
}
