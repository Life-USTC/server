import type { WelcomeMatchedSection } from "@/features/welcome/lib/welcome-bulk-import-types";

export function createWelcomeControllerDefaultState(input: {
  defaultSemesterId?: number | string | null;
  userImage?: string | null;
}) {
  return {
    areResultsVisible: false,
    importError: "",
    importMessage: "",
    importText: "",
    isCompletingProfile: false,
    isImporting: false,
    isMatching: false,
    matchedSections: [] as WelcomeMatchedSection[],
    selectedImage: input.userImage ?? undefined,
    selectedSectionIds: [] as number[],
    selectedSemesterId: input.defaultSemesterId
      ? String(input.defaultSemesterId)
      : "",
    unmatchedCodes: [] as string[],
  };
}
