export type DescriptionTargetType =
  | "section"
  | "course"
  | "teacher"
  | "homework";

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

export type DescriptionViewer = {
  isAuthenticated: boolean;
  isSuspended: boolean;
  suspensionReason?: string | null;
  suspensionExpiresAt?: string | null;
};

export type DescriptionHistoryItem = {
  id: string;
  createdAt: string;
  previousContent: string | null;
  nextContent: string;
  editor: EditorSummary | null;
};

export type DescriptionPayload = {
  description: DescriptionData;
  history?: DescriptionHistoryItem[];
  viewer: DescriptionViewer;
};

export type DescriptionCopy = {
  editorUnknown: string;
  loadFailed: string;
  updateError: string;
};
