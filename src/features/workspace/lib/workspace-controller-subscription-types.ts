import type { MatchedSection } from "./workspace-controller-helpers";
import type { SubscriptionsCopy } from "./workspace-controller-subscriptions";

export type SubscriptionActionSetters = {
  setBulkImportError: (value: string) => void;
  setBulkImportMessage: (value: string) => void;
  setBulkImportOpen: (value: boolean) => void;
  setBulkImportSemesterId: (value: string) => void;
  setBulkImportText: (value: string) => void;
  setConfirmImportOpen: (value: boolean) => void;
  setImportingSections: (value: boolean) => void;
  setMatchedSections: (value: MatchedSection[]) => void;
  setMatchingSections: (value: boolean) => void;
  setRemovingSectionId: (value: number | null) => void;
  setSelectedImportSectionIds: (value: number[]) => void;
  setSubscriptionActionError: (value: string) => void;
  setUnmatchedSectionCodes: (value: string[]) => void;
};

export type SubscriptionActionGetters = {
  getBulkImportSemesterId: () => string;
  getBulkImportText: () => string;
  getCurrentSemesterId: () => number | null | undefined;
  getSelectedImportSectionIds: () => number[];
  getSubscriptionsCopy: () => SubscriptionsCopy;
};

export type WorkspaceSubscriptionActionInput = SubscriptionActionGetters &
  SubscriptionActionSetters & {
    invalidateAll: () => Promise<void>;
    onSuccess?: (message: string) => void;
  };
