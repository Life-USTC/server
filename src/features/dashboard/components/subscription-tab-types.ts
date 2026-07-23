import type {
  DashboardDashboardCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import type {
  DashboardNamed,
  FormatMessage,
  NameFormatter,
} from "./dashboard-component-types";

export type {
  DashboardNamed,
  FormatMessage,
  NameFormatter,
} from "./dashboard-component-types";

export type MatchedImportSection = {
  campus?: DashboardNamed | null;
  code: string;
  course: DashboardNamed;
  id: number;
  semester?: DashboardNamed | null;
  teachers: DashboardNamed[];
};

export type DashboardSubscriptionsTabCopy = DashboardSubscriptionsCopy & {
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

export type DashboardSubscriptionsSignedData = SignedDashboardData & {
  subscriptions: NonNullable<SignedDashboardData["subscriptions"]> & {
    calendarSubscriptionUrl?: string | null;
    semesters: Array<{
      id: number | string;
      nameCn: string;
    }>;
  };
};

export type DashboardSubscriptionSectionId = number;

export type DashboardSubscriptionsTabProps = {
  bulkImportError: string;
  bulkImportMessage: string;
  bulkImportSemesterId: string;
  bulkImportText: string;
  canMatchImportSections: boolean;
  confirmImportSections: () => void | Promise<void>;
  copyCalendarLink: (event: MouseEvent) => void | Promise<void>;
  dashboardCopy: DashboardDashboardCopy;
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
    sectionId: DashboardSubscriptionSectionId,
  ) => boolean | Promise<boolean>;
  removingSectionId: DashboardSubscriptionSectionId | null;
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
  sectionCopy: DashboardSectionCopy;
  selectedImportCount: number;
  selectedImportSectionIdSet: Set<number>;
  signedData: DashboardSubscriptionsSignedData;
  subscriptionActionError: string;
  subscriptionActionMessage: string;
  subscribeQuickAddSections: (
    selectedSectionIds: number[],
  ) => void | Promise<void>;
  subscriptionsCopy: DashboardSubscriptionsTabCopy;
  toggleImportSectionSelection: (sectionId: number) => void;
  unmatchedSectionCodes: string[];
};
