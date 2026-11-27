import type {
  SignedWorkspaceData,
  WorkspaceCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import type {
  FormatMessage,
  NameFormatter,
  WorkspaceNamed,
} from "./workspace-component-types";

export type {
  FormatMessage,
  NameFormatter,
  WorkspaceNamed,
} from "./workspace-component-types";

export type MatchedImportSection = {
  campus?: WorkspaceNamed | null;
  code: string;
  course: WorkspaceNamed;
  id: number;
  semester?: WorkspaceNamed | null;
  teachers: WorkspaceNamed[];
};

export type WorkspaceSubscriptionsSignedData = SignedWorkspaceData & {
  subscriptions: NonNullable<SignedWorkspaceData["subscriptions"]> & {
    calendarSubscriptionUrl?: string | null;
    semesters: Array<{
      id: number | string;
      nameCn: string;
    }>;
  };
};

export type WorkspaceSubscriptionSectionId = number;

export type WorkspaceSubscriptionsTabProps = {
  bulkImportError: string;
  bulkImportMessage: string;
  bulkImportSemesterId: string;
  bulkImportText: string;
  canMatchImportSections: boolean;
  confirmImportSections: () => void | Promise<void>;
  workspaceCopy: WorkspaceCopy;
  formatMessage: FormatMessage;
  isBulkImportOpen: boolean;
  isConfirmImportOpen: boolean;
  isImportingSections: boolean;
  isMatchingSections: boolean;
  matchedSections: MatchedImportSection[];
  matchImportSections: () => Promise<boolean>;
  namePrimary: NameFormatter;
  nameSecondary: NameFormatter;
  openBulkImportDialog: () => void;
  removeSubscribedSection: (
    sectionId: WorkspaceSubscriptionSectionId,
  ) => boolean | Promise<boolean>;
  removingSectionId: WorkspaceSubscriptionSectionId | null;
  resetBulkImport: () => void;
  searchQuickAddSections: (input: {
    semesterId: string;
    text: string;
  }) => Promise<MatchedImportSection[]>;
  sectionCopy: WorkspaceSectionCopy;
  selectedImportSectionIdSet: Set<number>;
  signedData: WorkspaceSubscriptionsSignedData;
  subscriptionActionError: string;
  subscribeQuickAddSections: (
    selectedSectionIds: number[],
  ) => void | Promise<void>;
  subscriptionsCopy: WorkspaceSubscriptionsCopy;
  toggleImportSectionSelection: (sectionId: number) => void;
  unmatchedSectionCodes: string[];
};
