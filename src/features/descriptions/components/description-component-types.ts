export type DescriptionCopy = {
  edit: string;
  editorUnknown: string;
  editedBy: string;
  emptyValue: string;
  empty: string;
  historyEmpty: string;
  historyTitle: string;
  lastEdited: string;
  loginToEdit: string;
  previousLabel: string;
  suspendedExpires: string;
  suspendedMessage: string;
  suspendedPermanent: string;
  suspendedReason: string;
  suspendedTitle: string;
  title: string;
  updatedLabel: string;
};

export type DescriptionViewer = {
  isAuthenticated?: boolean;
  isSuspended?: boolean;
  suspensionExpiresAt?: string | null;
  suspensionReason?: string | null;
};

export type DescriptionContent = {
  content?: string | null;
  lastEditedAt?: string | null;
  lastEditedBy?: DescriptionHistoryEditor | null;
};

export type DescriptionHistoryEditor = {
  id: string;
  image: string | null;
  name: string | null;
  username: string | null;
};

export type DescriptionHistoryItem = {
  createdAt: string;
  editor: DescriptionHistoryEditor | null;
  id: string;
  nextContent: string;
  previousContent: string | null;
};
