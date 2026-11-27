<script lang="ts">
import { untrack } from "svelte";
import WelcomeGuideCard from "@/features/welcome/components/WelcomeGuideCard.svelte";
import WelcomeOAuthProfileCard from "@/features/welcome/components/WelcomeOAuthProfileCard.svelte";
import WelcomeProfileForm from "@/features/welcome/components/WelcomeProfileForm.svelte";
import WelcomeStepper from "@/features/welcome/components/WelcomeStepper.svelte";
import WelcomeSubscriptionsStep from "@/features/welcome/components/WelcomeSubscriptionsStep.svelte";
import { createWelcomeBulkImportActions } from "@/features/welcome/lib/welcome-bulk-import-actions";
import { createWelcomeControllerDefaultState } from "@/features/welcome/lib/welcome-controller-default-state";
import { createCompleteProfileAction } from "@/features/welcome/lib/welcome-controller-state";
import { formatWelcomeCopy as formatCopy } from "@/features/welcome/lib/welcome-display";
import { welcomeStepNumber } from "@/features/welcome/lib/welcome-steps";
import type { PageProps } from "./$types";

let { data, form }: PageProps = $props();
const state = $state(
  untrack(() =>
    createWelcomeControllerDefaultState({
      defaultSemesterId: data.defaultSemesterId,
      userImage: data.user.image,
    }),
  ),
);
const welcomeCopy = $derived(data.copy.welcome);
const progressLabel = $derived(
  formatCopy(welcomeCopy.stepProgress, {
    current: welcomeStepNumber(data.step),
    total: data.stepIndicators.length,
  }),
);

const actions = createWelcomeBulkImportActions({
  state,
  getBulkCopy: () => data.copy.subscriptions.bulkImport,
  getLocale: () => data.locale,
  getSubscriptionsCopy: () => data.copy.subscriptions,
  getWelcomeCopy: () => data.copy.welcome,
});

const completeProfileAction = createCompleteProfileAction({
  setCompleting: (value) => {
    state.isCompletingProfile = value;
  },
});
</script>

<svelte:head><title>{welcomeCopy.title} - Life@USTC</title></svelte:head>

<section class="mx-auto grid min-h-[calc(100dvh-8rem)] w-full max-w-2xl content-start gap-6 py-8">
  <WelcomeStepper {progressLabel} steps={data.stepIndicators} />

  {#if data.step === "profile"}
    <WelcomeProfileForm
      {data}
      {completeProfileAction}
      formMessage={form?.message}
      isCompletingProfile={state.isCompletingProfile}
      bind:selectedImage={state.selectedImage}
    />

    <WelcomeOAuthProfileCard
      callbackUrl={data.callbackUrl}
      oauthProviders={data.oauthProviders}
      oauthRefreshed={data.oauthRefreshed}
      {welcomeCopy}
    />
  {:else if data.step === "subscriptions"}
    <WelcomeSubscriptionsStep
      {actions}
      {data}
      {state}
      bind:importText={state.importText}
      bind:selectedSemesterId={state.selectedSemesterId}
    />
  {:else}
    <WelcomeGuideCard
      backUrl={data.backUrl}
      finishUrl={data.nextUrl}
      {welcomeCopy}
    />
  {/if}
</section>
