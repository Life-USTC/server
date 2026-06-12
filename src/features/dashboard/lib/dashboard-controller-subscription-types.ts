import type { MatchedSection } from "./dashboard-controller-helpers";
import type { SubscriptionsCopy } from "./dashboard-controller-subscriptions";

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
  setPendingRemoveSectionId: (value: number | null) => void;
  setRemovingSectionId: (value: number | null) => void;
  setSelectedImportSectionIds: (value: number[]) => void;
  setSubscriptionActionError: (value: string) => void;
  setSubscriptionActionMessage: (value: string) => void;
  setUnmatchedSectionCodes: (value: string[]) => void;
};

export type SubscriptionActionGetters = {
  getBulkImportSemesterId: () => string;
  getBulkImportText: () => string;
  getCurrentSemesterId: () => number | null | undefined;
  getPendingRemoveSectionId: () => number | null;
  getSelectedImportSectionIds: () => number[];
  getSubscriptionsCopy: () => SubscriptionsCopy;
};

export type DashboardSubscriptionActionInput = SubscriptionActionGetters &
  SubscriptionActionSetters & {
    invalidateAll: () => Promise<void>;
  };
