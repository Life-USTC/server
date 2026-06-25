import type {
  DescriptionData,
  DescriptionHistoryItem,
  DescriptionViewer,
  EditorSummary,
} from "@/features/descriptions/lib/description-payload-types";

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

export type DescriptionContent = DescriptionData;
export type DescriptionHistoryEditor = EditorSummary;
export type { DescriptionHistoryItem, DescriptionViewer };
