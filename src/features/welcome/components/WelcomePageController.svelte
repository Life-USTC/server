<script lang="ts">
import WelcomeImportDialogs from "@/features/welcome/components/WelcomeImportDialogs.svelte";
import WelcomeNextStepsCard from "@/features/welcome/components/WelcomeNextStepsCard.svelte";
import WelcomeProfileForm from "@/features/welcome/components/WelcomeProfileForm.svelte";
import { createWelcomeBulkImportActions } from "@/features/welcome/lib/welcome-bulk-import-actions";
import { createWelcomeControllerDefaultState } from "@/features/welcome/lib/welcome-controller-default-state";
import {
  buildWelcomeSemesterOptions,
  createCompleteProfileAction,
} from "@/features/welcome/lib/welcome-controller-state";
import {
  displayWelcomeName,
  formatWelcomeCopy,
} from "@/features/welcome/lib/welcome-display";
import type {
  WelcomeActionData,
  WelcomeMatchedSection,
  WelcomePageData,
} from "./welcome-component-types";

export let data: WelcomePageData;
export let form: WelcomeActionData;

let {
  importError,
  importMessage,
  importText,
  isBulkImportOpen,
  isCompletingProfile: _isCompletingProfile,
  isConfirmImportOpen,
  isImporting,
  isMatching,
  matchedSections,
  selectedImage,
  selectedSectionIds,
  selectedSemesterId,
  unmatchedCodes,
} = createWelcomeControllerDefaultState({
  defaultSemesterId: data.defaultSemesterId,
  userImage: data.user.image,
});
$: copy = data.copy;
$: bulkCopy = copy.subscriptions.bulkImport;
$: profileCopy = copy.profile;
$: welcomeCopy = copy.welcome;
$: avatarOptions =
  data.user.profilePictures.length > 0 ? data.user.profilePictures : [];
$: currentImage = data.user.image ?? "";
$: previewImage = selectedImage || "/images/icon.png";
$: selectedSectionIdSet = new Set(selectedSectionIds);
$: selectedCount = selectedSectionIds.length;
$: canMatch = importText.trim().length > 0 && !isMatching;
$: semesterOptions = buildWelcomeSemesterOptions(data.semesters, data.locale);

function formatCopy(value: string, params: Record<string, number | string>) {
  return formatWelcomeCopy(value, params);
}

function displayName(item?: WelcomeMatchedSection["course"] | null) {
  return displayWelcomeName(item, data.locale);
}

const {
  confirmImport,
  matchSections,
  resetBulkImport,
  setSectionSelection,
  toggleSectionSelection,
} = createWelcomeBulkImportActions({
  formatCopy,
  getBulkCopy: () => bulkCopy,
  getImportText: () => importText,
  getLocale: () => data.locale,
  getSelectedSectionIds: () => selectedSectionIds,
  getSelectedSectionIdSet: () => selectedSectionIdSet,
  getSelectedSemesterId: () => selectedSemesterId,
  getWelcomeCopy: () => welcomeCopy,
  setBulkImportOpen: (value) => {
    isBulkImportOpen = value;
  },
  setConfirmImportOpen: (value) => {
    isConfirmImportOpen = value;
  },
  setImportError: (value) => {
    importError = value;
  },
  setImporting: (value) => {
    isImporting = value;
  },
  setImportMessage: (value) => {
    importMessage = value;
  },
  setImportText: (value) => {
    importText = value;
  },
  setMatchedSections: (value) => {
    matchedSections = value;
  },
  setMatching: (value) => {
    isMatching = value;
  },
  setSelectedSectionIds: (value) => {
    selectedSectionIds = value;
  },
  setUnmatchedCodes: (value) => {
    unmatchedCodes = value;
  },
});

const completeProfileAction = createCompleteProfileAction({
  setCompleting: (value) => {
    _isCompletingProfile = value;
  },
});
</script>

<svelte:head><title>{welcomeCopy.title} - Life@USTC</title></svelte:head>

<section class="mx-auto grid min-h-[calc(100vh-14rem)] w-full max-w-5xl content-center gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
  <WelcomeProfileForm
    {avatarOptions}
    {completeProfileAction}
    {copy}
    {currentImage}
    formMessage={form?.message}
    isCompletingProfile={_isCompletingProfile}
    {previewImage}
    {profileCopy}
    bind:selectedImage
    user={data.user}
    {welcomeCopy}
  />

  <WelcomeNextStepsCard
    {importMessage}
    onOpenBulkImport={() => {
      isBulkImportOpen = true;
    }}
    {welcomeCopy}
  />

  <WelcomeImportDialogs
    {bulkCopy}
    {canMatch}
    {confirmImport}
    {displayName}
    {formatCopy}
    {importError}
    {importMessage}
    bind:importText
    bind:isBulkImportOpen
    bind:isConfirmImportOpen
    {isImporting}
    {isMatching}
    {matchSections}
    {matchedSections}
    {resetBulkImport}
    {selectedCount}
    {selectedSectionIdSet}
    bind:selectedSemesterId
    {semesterOptions}
    {setSectionSelection}
    {toggleSectionSelection}
    {unmatchedCodes}
    {welcomeCopy}
  />
</section>
