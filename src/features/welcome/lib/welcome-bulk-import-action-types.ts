import type { WelcomeMatchedSection } from "@/features/welcome/lib/welcome-bulk-import-types";

export type BulkCopy = Record<string, string>;
export type WelcomeCopy = Record<string, string>;

export type WelcomeBulkImportActionInput = {
  formatCopy: (
    value: string,
    params: Record<string, number | string>,
  ) => string;
  getBulkCopy: () => BulkCopy;
  getImportText: () => string;
  getLocale: () => string;
  getSelectedSectionIds: () => number[];
  getSelectedSectionIdSet: () => Set<number>;
  getSelectedSemesterId: () => string;
  getWelcomeCopy: () => WelcomeCopy;
  setBulkImportOpen: (value: boolean) => void;
  setConfirmImportOpen: (value: boolean) => void;
  setImportError: (value: string) => void;
  setImporting: (value: boolean) => void;
  setImportMessage: (value: string) => void;
  setImportText: (value: string) => void;
  setMatchedSections: (value: WelcomeMatchedSection[]) => void;
  setMatching: (value: boolean) => void;
  setSelectedSectionIds: (value: number[]) => void;
  setUnmatchedCodes: (value: string[]) => void;
};
