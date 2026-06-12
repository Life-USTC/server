import type { CommentsInitialData } from "@/features/comments/lib/comment-panel-data";
import type { DescriptionPayload } from "@/features/descriptions/lib/description-card-actions";

export type CatalogDetailDescriptionCopy = {
  cancel: string;
  edit: string;
  editedBy: string;
  editorPlaceholder: string;
  editorUnknown: string;
  empty: string;
  emptyValue: string;
  historyEmpty: string;
  historyTitle: string;
  lastEdited: string;
  loadFailed: string;
  loginToEdit: string;
  markdownGuide: string;
  previewEmpty: string;
  previousLabel: string;
  save: string;
  saving: string;
  suspendedExpires: string;
  suspendedMessage: string;
  suspendedPermanent: string;
  suspendedReason: string;
  suspendedTitle: string;
  tabPreview: string;
  tabWrite: string;
  title: string;
  updateError: string;
  updatedLabel: string;
};

export type CatalogDetailCommentsData = CommentsInitialData | null;
export type CatalogDetailDescriptionData = DescriptionPayload;
