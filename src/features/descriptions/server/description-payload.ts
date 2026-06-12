import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";

export type EditorSummary = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
};

export type DescriptionData = {
  id: string | null;
  content: string;
  updatedAt: string | null;
  lastEditedAt: string | null;
  lastEditedBy: EditorSummary | null;
};

export type HistoryItem = {
  id: string;
  createdAt: string;
  previousContent: string | null;
  nextContent: string;
  editor: EditorSummary | null;
};

export type ViewerSummary = {
  userId: string | null;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspensionExpiresAt: string | null;
};

export type DescriptionPayload = {
  description: DescriptionData;
  history: HistoryItem[];
  viewer: ViewerSummary;
};

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
  viewer: ViewerSummary,
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
): HistoryItem[] {
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
