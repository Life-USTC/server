import type {
  DescriptionData,
  DescriptionHistoryItem,
  DescriptionViewer,
  EditorSummary,
} from "@/features/descriptions/lib/description-payload-types";
import type messages from "../../../../messages/en-us.json";

export type DescriptionCopy = Omit<
  typeof messages.descriptions,
  "editAction" | "historyError" | "updateSuccess"
> & { updateSuccess?: string };

export type DescriptionContent = DescriptionData;
export type DescriptionHistoryEditor = EditorSummary;
export type { DescriptionHistoryItem, DescriptionViewer };
