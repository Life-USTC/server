<script lang="ts">
import WelcomeGuideCard from "@/features/welcome/components/WelcomeGuideCard.svelte";
import WelcomeOAuthProfileCard from "@/features/welcome/components/WelcomeOAuthProfileCard.svelte";
import WelcomeProfileForm from "@/features/welcome/components/WelcomeProfileForm.svelte";
import WelcomeStepper from "@/features/welcome/components/WelcomeStepper.svelte";
import WelcomeSubscriptionsStep from "@/features/welcome/components/WelcomeSubscriptionsStep.svelte";
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
import { welcomeStepNumber } from "@/features/welcome/lib/welcome-steps";
import type {
  WelcomeActionData,
  WelcomeMatchedSection,
  WelcomePageData,
} from "./welcome-component-types";

export let data: WelcomePageData;
export let form: WelcomeActionData;

let {
  areResultsVisible,
  importError,
  importMessage,
  importText,
  isCompletingProfile: _isCompletingProfile,
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
$: previewImage = selectedImage || currentImage || "/images/icon.png";
$: selectedSectionIdSet = new Set(selectedSectionIds);
$: canMatch = importText.trim().length > 0 && !isMatching;
$: semesterOptions = buildWelcomeSemesterOptions(data.semesters, data.locale);
$: progressLabel = formatCopy(welcomeCopy.stepProgress, {
  current: welcomeStepNumber(data.step),
  total: data.stepIndicators.length,
});

function formatCopy(value: string, params: Record<string, number | string>) {
  return formatWelcomeCopy(value, params);
}

function displayName(item?: WelcomeMatchedSection["course"] | null) {
  return displayWelcomeName(item, data.locale);
}

const { confirmImport, matchSections, setSectionSelection } =
  createWelcomeBulkImportActions({
    formatCopy,
    getBulkCopy: () => bulkCopy,
    getImportText: () => importText,
    getLocale: () => data.locale,
    getSelectedSectionIds: () => selectedSectionIds,
    getSelectedSemesterId: () => selectedSemesterId,
    getWelcomeCopy: () => welcomeCopy,
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
    setResultsVisible: (value) => {
      areResultsVisible = value;
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

<section class="mx-auto grid min-h-[calc(100dvh-8rem)] w-full max-w-xl content-start gap-6 py-8">
  <WelcomeStepper {progressLabel} steps={data.stepIndicators} />

  {#if data.step === "profile"}
    <WelcomeProfileForm
      {avatarOptions}
      callbackUrl={data.callbackUrl}
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

    <WelcomeOAuthProfileCard
      callbackUrl={data.callbackUrl}
      oauthProviders={data.oauthProviders}
      oauthRefreshed={data.oauthRefreshed}
      {welcomeCopy}
    />
  {:else if data.step === "subscriptions"}
    <WelcomeSubscriptionsStep
      {areResultsVisible}
      backUrl={data.backUrl}
      {bulkCopy}
      {canMatch}
      {confirmImport}
      {displayName}
      {formatCopy}
      {importError}
      {importMessage}
      bind:importText
      {isImporting}
      {isMatching}
      {matchSections}
      {matchedSections}
      nextUrl={data.nextUrl}
      {selectedCount}
      {selectedSectionIdSet}
      bind:selectedSemesterId
      {semesterOptions}
      {setSectionSelection}
      {unmatchedCodes}
      {welcomeCopy}
    />
  {:else}
    <WelcomeGuideCard
      backUrl={data.backUrl}
      finishUrl={data.nextUrl}
      {welcomeCopy}
    />
  {/if}
</section>
