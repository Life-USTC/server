<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import SectionDetailPrimaryActions from "./SectionDetailPrimaryActions.svelte";
import type {
  SectionLocalizedName,
  SectionPrimaryName,
} from "./section-basic-info-types";

type SectionHeaderCopy = {
  addToCalendar: string;
  subscribeLabel: string;
  teachingSection: string;
  unsubscribeLabel: string;
  unsubscribing: string;
};

type SectionHeaderSection = {
  campus?: SectionLocalizedName | null;
  code: string;
  limitCount?: number | null;
  semester?: {
    nameCn?: string | null;
  } | null;
  stdCount?: number | null;
};

type SectionHeaderViewer = {
  isSubscribed?: boolean;
};

type SubscriptionActionKey = "subscribe" | "unsubscribe";

export let courseName: string;
export let courseSecondaryName: string;
export let formError: string | null | undefined;
export let notAvailable: string;
export let onOpenCalendar: () => void;
export let onOpenSubscribe: () => void;
export let primaryName: SectionPrimaryName;
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
    <div class="flex flex-wrap gap-2">
      <Badge variant="secondary">{sectionCopy.teachingSection}</Badge>
      <Badge class="font-mono" variant="outline">{section.code}</Badge>
    </div>
  {/snippet}
  {#snippet actions()}
    <SectionDetailPrimaryActions
      {onOpenCalendar}
      {onOpenSubscribe}
      {sectionCopy}
      {subscriptionAction}
      {subscriptionPendingAction}
      {viewer}
    />
  {/snippet}
  {#snippet after()}
    <div class="grid gap-4">
      <div class="flex flex-wrap gap-2">
        {#if section.semester}<Badge variant="ghost">{section.semester.nameCn}</Badge>{/if}
        {#if section.campus}<Badge variant="ghost">{primaryName(section.campus)}</Badge>{/if}
        {#if section.stdCount !== null || section.limitCount !== null}
          <Badge variant="ghost">{section.stdCount ?? 0} / {section.limitCount ?? notAvailable}</Badge>
        {/if}
      </div>

      {#if formError}
        <Alert.Root variant="destructive">
          <Alert.Description>{formError}</Alert.Description>
        </Alert.Root>
      {/if}
    </div>
  {/snippet}
</PageHeader>
