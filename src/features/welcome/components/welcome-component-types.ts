import type { SubmitFunction } from "@sveltejs/kit";
import type { WelcomeMatchedSection } from "@/features/welcome/lib/welcome-bulk-import-types";
import type { WelcomeStep } from "@/features/welcome/lib/welcome-steps";

export type WelcomeStepIndicator = {
  id: WelcomeStep;
  label: string;
  number: number;
  state: "complete" | "current" | "upcoming";
};

export type WelcomeProfileCopy = {
  avatarUpload: string;
  avatarUploadHint: string;
  name: string;
  namePlaceholder: string;
  profilePicture: string;
  saving: string;
  username: string;
  usernamePlaceholder: string;
  usernameValidation: string;
};

export type WelcomeCopy = Record<string, string> & {
  back: string;
  browseCourses: string;
  browseSections: string;
  bulkImportCta: string;
  finishDescription: string;
  finishTitle: string;
  skipForNow: string;
  startUsing: string;
  stepFinish: string;
  stepProfile: string;
  stepProgress: string;
  stepSubscriptions: string;
  confirmImportTitle: string;
  avatarLater: string;
  continue: string;
  description: string;
  firstSignIn: string;
  importing: string;
  matchedSummary: string;
  nextStepsDescription: string;
  nextStepsTitle: string;
  subscriptionsBrowseDescription: string;
  subscriptionsBrowseTitle: string;
  subscriptionsCodeExampleCourse: string;
  subscriptionsCodeExampleCourseHint: string;
  subscriptionsCodeExampleCourseSection: string;
  subscriptionsCodeExampleCourseSectionHint: string;
  subscriptionsCodeExampleSection: string;
  subscriptionsCodeExampleSectionHint: string;
  subscriptionsCodesDescription: string;
  subscriptionsCodesTitle: string;
  subscriptionsWhyDescription: string;
  subscriptionsWhyTitle: string;
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
  backUrl: string | null;
  callbackUrl: string;
  copy: WelcomePageCopy;
  defaultSemesterId?: number | string | null;
  locale: string;
  nextUrl: string;
  oauthProviders: Array<{ id: string; name: string }>;
  oauthRefreshed: boolean;
  semesters: WelcomeSemester[];
  step: WelcomeStep;
  stepIndicators: WelcomeStepIndicator[];
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

export type { WelcomeMatchedSection };
