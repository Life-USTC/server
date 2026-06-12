import type { SubmitFunction } from "@sveltejs/kit";
import type {
  AdminModerationComment,
  AdminModerationCommentsCopy,
} from "./admin-moderation-comment-types";
import type {
  AdminModerationDescription,
  AdminModerationDescriptionCopy,
  AdminModerationDescriptionOption,
} from "./admin-moderation-description-types";

export type AdminModerationTab =
  | "comments"
  | "descriptions"
  | "homeworks"
  | "suspensions";

export type AdminModerationCopy = AdminModerationCommentsCopy &
  AdminModerationDescriptionCopy & {
    active: string;
    cancelButton: string;
    close: string;
    confirmButton: string;
    currentView: string;
    defaultBanReason: string;
    deleteHomeworkAction: string;
    deleteHomeworkAuditDescription: string;
    deleteHomeworkDescription: string;
    deleteHomeworkTitle: string;
    descriptionContent: string;
    filterAction: string;
    filterQueue: string;
    filterQueueDescription: string;
    editedAt: string;
    expiresAt: string;
    guestLabel: string;
    homeworkStatusActive: string;
    homeworkStatusDeleted: string;
    homeworkTiming: string;
    lifted: string;
    liftSuspensionAction: string;
    manageUser: string;
    noHomeworks: string;
    noReason: string;
    noSuspensions: string;
    openTarget: string;
    pageDescription: string;
    permanent: string;
    refreshQueue: string;
    refreshingQueue: string;
    saving: string;
    searchAllPlaceholder: string;
    searchPlaceholder: string;
    suspendAction: string;
    suspendAuthorDescription: string;
    suspendExpires: string;
    suspendFailed: string;
    suspendSuccess: string;
    suspendReason: string;
    suspending: string;
    suspensionDetails: string;
    tabsLabel: string;
    title: string;
    updateFailed: string;
  };

export type AdminModerationAdminCopy = {
  title: string;
};

export type AdminModerationCommonCopy = {
  home: string;
};

export type AdminModerationHeaderTab = readonly [
  AdminModerationTab,
  string,
  number,
];

export type AdminModerationDescriptionFilters = {
  descriptionContent?: string | null;
  descriptionTarget?: string | null;
  search: string;
  status?: string | null;
};

export type AdminModerationHomework = {
  createdAt: string | Date;
  deletedAt?: string | Date | null;
  id: string;
  section: {
    code: string;
    course: { nameCn: string };
  };
  submissionDueAt?: string | Date | null;
  title: string;
};

export type AdminModerationSuspension = {
  expiresAt?: string | Date | null;
  id: string;
  liftedAt?: string | Date | null;
  reason?: string | null;
  user: {
    id: string;
    name?: string | null;
    username?: string | null;
  };
};

export type AdminModerationPageData = {
  comments: AdminModerationComment[];
  descriptions: AdminModerationDescription[];
  filters: AdminModerationDescriptionFilters;
  homeworks: AdminModerationHomework[];
  suspensions: AdminModerationSuspension[];
  tab: AdminModerationTab;
};

export type AdminModerationStatusOptions = readonly (readonly [
  string,
  string,
])[];

export type AdminModerationDurationOption = {
  label: string;
  value: string;
};

export type AdminModerationEnhancedAction = SubmitFunction;

export type AdminModerationDescriptionOptions =
  AdminModerationDescriptionOption[];
