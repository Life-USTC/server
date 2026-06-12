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
    subscribeSelected: string;
    title: string;
  };
  iCalLink: string;
  sectionsIncluded: string;
  semesterGroup: string;
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

export type DashboardSubscriptionSectionId = number | string;

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
  matchImportSections: () => void | Promise<void>;
  namePrimary: NameFormatter;
  nameSecondary: NameFormatter;
  openBulkImportDialog: () => void;
  pendingRemoveSectionId: DashboardSubscriptionSectionId | null;
  removeSubscribedSection: (
    sectionId: DashboardSubscriptionSectionId,
  ) => void | Promise<void>;
  removingSectionId: DashboardSubscriptionSectionId | null;
  resetBulkImport: () => void;
  sectionCopy: DashboardSectionCopy;
  selectedImportCount: number;
  selectedImportSectionIdSet: Set<number>;
  signedData: DashboardSubscriptionsSignedData;
  subscriptionActionError: string;
  subscriptionActionMessage: string;
  subscriptionsCopy: DashboardSubscriptionsTabCopy;
  toggleImportSectionSelection: (sectionId: number) => void;
  unmatchedSectionCodes: string[];
};
