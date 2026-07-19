export type { DescriptionTargetType } from "./description-target-types";

export type EditorSummary = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
};

export type DescriptionData = {
  id: string | null;
  content: string;
  renderedHtml: string;
  updatedAt: string | null;
  lastEditedAt: string | null;
  lastEditedBy: EditorSummary | null;
};

export type DescriptionHistoryItem = {
  id: string;
  createdAt: string;
  previousContent: string | null;
  nextContent: string;
  editor: EditorSummary | null;
};

export type DescriptionViewer = {
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
  history: DescriptionHistoryItem[];
  viewer: DescriptionViewer;
};
