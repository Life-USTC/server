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

export type WorkspaceSubscriptionsTabCopy = WorkspaceSubscriptionsCopy & {
  bulkImport: {
    cancel: string;
    confirmTitle: string;
    description: string;
    importing: string;
    matchButton: string;
    matchedSummary: string;
    matching: string;
    placeholder: string;
    sectionCodesLabel: string;
    semesterLabel: string;
    semesterPlaceholder: string;
    subscribeSelected: string;
    title: string;
  };
  quickAdd: {
    alreadySubscribed: string;
    cancel: string;
    codeLabel: string;
    description: string;
    emptyDescription: string;
    emptyTitle: string;
    hint: string;
    placeholder: string;
    resultsDescription: string;
    resultsLabel: string;
    searchButton: string;
    searching: string;
    selectSection: string;
    subscribeSelected: string;
    subscribing: string;
    title: string;
  };
  iCalLink: string;
  cancelUnsubscribe: string;
  closeDetails: string;
  confirmUnsubscribe: string;
  detailsDescription: string;
  openCourse: string;
  openDetails: string;
  sectionIncluded: string;
  sectionsIncluded: string;
  semester: string;
  semesterGroup: string;
  unsubscribe: string;
  unsubscribeDescription: string;
  unsubscribeTitle: string;
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
  }) => Promise<{
    message: string;
    sections: MatchedImportSection[];
    selectedSectionIds: number[];
    unmatchedCodes: string[];
  }>;
  sectionCopy: WorkspaceSectionCopy;
  selectedImportSectionIdSet: Set<number>;
  signedData: WorkspaceSubscriptionsSignedData;
  subscriptionActionError: string;
  subscribeQuickAddSections: (
    selectedSectionIds: number[],
  ) => void | Promise<void>;
  subscriptionsCopy: WorkspaceSubscriptionsTabCopy;
  toggleImportSectionSelection: (sectionId: number) => void;
  unmatchedSectionCodes: string[];
};
