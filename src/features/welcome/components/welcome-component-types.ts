import type { SubmitFunction } from "@sveltejs/kit";
import type { WelcomeMatchedSection } from "@/features/welcome/lib/welcome-bulk-import-types";

export type WelcomeProfileCopy = {
  name: string;
  namePlaceholder: string;
  profilePicture: string;
  saving: string;
  username: string;
  usernamePlaceholder: string;
  usernameValidation: string;
};

export type WelcomeCopy = Record<string, string> & {
  browseCourses: string;
  browseSections: string;
  bulkImportCta: string;
  confirmImportTitle: string;
  avatarLater: string;
  continue: string;
  description: string;
  firstSignIn: string;
  importing: string;
  matchedSummary: string;
  nextStepsDescription: string;
  nextStepsTitle: string;
  noMatchingSections: string;
  sectionCodesLabel: string;
  selectSection: string;
  subscribeSelected: string;
  title: string;
};

export type WelcomeRootCopy = {
  accessibility: {
    avatarOption: string;
  };
};

export type WelcomeBulkImportCopy = Record<string, string> & {
  cancel: string;
  description: string;
  matchButton: string;
  matching: string;
  placeholder: string;
  semesterLabel: string;
  semesterPlaceholder: string;
  title: string;
  unmatchedCodes: string;
};

export type WelcomePageCopy = WelcomeRootCopy & {
  profile: WelcomeProfileCopy;
  subscriptions: {
    bulkImport: WelcomeBulkImportCopy;
  };
  welcome: WelcomeCopy;
};

export type WelcomeProfileUser = {
  name?: string | null;
  username?: string | null;
};

export type CompleteProfileAction = SubmitFunction;

export type WelcomeSemester = {
  id: number | string;
  nameCn?: string | null;
  nameEn?: string | null;
  namePrimary?: string | null;
  nameSecondary?: string | null;
};

export type WelcomeSelectOption = {
  label: string;
  value: string;
};

export type WelcomePageUser = WelcomeProfileUser & {
  image?: string | null;
  profilePictures: string[];
};

export type WelcomePageData = {
  copy: WelcomePageCopy;
  defaultSemesterId?: number | string | null;
  locale: string;
  semesters: WelcomeSemester[];
  user: WelcomePageUser;
};

export type WelcomeActionData = {
  message?: string;
} | null;

export type WelcomeFormatCopy = (
  value: string,
  params: Record<string, number | string>,
) => string;

export type WelcomeDisplayName = (
  item?: WelcomeMatchedSection["course"] | null,
) => string;

export type WelcomeImportAction = () => void | Promise<void>;

export type WelcomeSectionSelectionSetter = (
  sectionId: number,
  checked: boolean,
) => void;

export type WelcomeSectionSelectionToggle = (sectionId: number) => void;

export type { WelcomeMatchedSection };
