<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import PageHeader from "$lib/components/PageHeader.svelte";
import TruncatedCode from "$lib/components/TruncatedCode.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import SectionDetailPrimaryActions from "./SectionDetailPrimaryActions.svelte";

type SectionHeaderCopy = {
  addToCalendar: string;
  historicalSectionDescription: string;
  historicalSectionLabel: string;
  subscribeLabel: string;
  teachingSection: string;
  unsubscribeLabel: string;
  unsubscribing: string;
};

type SectionHeaderSection = {
  code: string;
  retiredAt?: string | Date | null;
};

type SectionHeaderViewer = {
  isSubscribed?: boolean;
};

type SubscriptionActionKey = "subscribe" | "unsubscribe";

export let courseName: string;
export let courseSecondaryName: string;
export let formError: string | null | undefined;
export let onOpenCalendar: () => void;
export let onOpenSubscribe: () => void;
export let section: SectionHeaderSection;
export let sectionCopy: SectionHeaderCopy;
export let subscriptionAction: (
  action: SubscriptionActionKey,
) => SubmitFunction;
export let subscriptionPendingAction: SubscriptionActionKey | null;
export let viewer: SectionHeaderViewer;
</script>

<PageHeader
  title={courseName}
  description={courseSecondaryName}
  actionsClass="hidden md:flex"
  titleClass="text-2xl leading-tight sm:text-3xl"
>
  {#snippet eyebrowContent()}
    <div class="flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{sectionCopy.teachingSection}</Badge>
      <TruncatedCode class="text-muted-foreground" text={section.code} />
    </div>
  {/snippet}
  {#snippet actions()}
    <SectionDetailPrimaryActions
      {onOpenCalendar}
      {onOpenSubscribe}
      retired={section.retiredAt != null}
      {sectionCopy}
      {subscriptionAction}
      {subscriptionPendingAction}
      {viewer}
    />
  {/snippet}
  {#snippet after()}
    {#if section.retiredAt != null || formError}
      <div class="grid gap-4">
        {#if section.retiredAt != null}
          <Alert.Root>
            <Alert.Title>{sectionCopy.historicalSectionLabel}</Alert.Title>
            <Alert.Description>{sectionCopy.historicalSectionDescription}</Alert.Description>
          </Alert.Root>
        {/if}

        {#if formError}
          <Alert.Root variant="destructive">
            <Alert.Description>{formError}</Alert.Description>
          </Alert.Root>
        {/if}
      </div>
    {/if}
  {/snippet}
</PageHeader>
