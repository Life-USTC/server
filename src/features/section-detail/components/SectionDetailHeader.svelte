<script lang="ts">
import PageHeader from "#lib/components/PageHeader.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import {
  type CatalogNamed,
  catalogLocalizedNames,
} from "@/features/catalog/lib/catalog-list-display";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import type { SubmitFunction } from "$app/forms";
import { page } from "$app/state";
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
  teachers?: CatalogNamed[];
  semester?: { nameCn?: string | null } | null;
  retiredAt?: string | Date | null;
};

type SectionHeaderViewer = {
  isSubscribed?: boolean;
  subscriptionKind?: "regular" | "auditor" | "teaching_assistant";
};

type SubscriptionActionKey = "subscribe" | "unsubscribe";

export let courseName: string;
export let readOnlyReason: string | undefined = undefined;
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
$: locale = page.data.locale === "en-us" ? "en-us" : "zh-cn";
$: hasCourseName = courseName !== section.code;
$: teacherNames = catalogLocalizedNames(section.teachers ?? [], locale);
$: subscriptionsCopy = getWorkspacePageCopy(locale).subscriptions;
</script>

<PageHeader
  title={courseName}
  titleClass={hasCourseName ? "" : "font-mono [overflow-wrap:anywhere]"}
  eyebrow={sectionCopy.teachingSection}
  description={courseSecondaryName}
  actionsClass="hidden md:flex"
  density="detail"
>
  {#snippet belowTitle()}
    {#if teacherNames || hasCourseName || section.semester?.nameCn}
    <div class="mt-2 grid min-w-0 gap-1">
      {#if teacherNames}<p class="break-words text-sm">{teacherNames}</p>{/if}
      {#if hasCourseName || section.semester?.nameCn}
      <p class="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {#if hasCourseName}<span class="min-w-0 font-mono [overflow-wrap:anywhere]" data-slot="catalog-code">{section.code}</span>{/if}
        {#if section.semester?.nameCn}<span>{formatSemesterName(locale, section.semester.nameCn)}</span>{/if}
      </p>
      {/if}
    </div>
    {/if}
  {/snippet}
  {#snippet actions()}
    <SectionDetailPrimaryActions
      {courseName}
      onOpenCalendar={onOpenCalendar}
      onOpenSubscribe={onOpenSubscribe}
      retired={section.retiredAt != null}
      sectionCopy={sectionCopy}
      subscriptionAction={subscriptionAction}
      subscriptionPendingAction={subscriptionPendingAction}
      viewer={viewer}
      {readOnlyReason}
    />
  {/snippet}
  {#snippet after()}
    {#if viewer.isSubscribed && viewer.subscriptionKind}
      <section class="flex flex-wrap items-center gap-2 text-sm" aria-label={subscriptionsCopy.mySubscription}>
        <span>{subscriptionsCopy.mySubscription}: {subscriptionsCopy.kindEditor[viewer.subscriptionKind]}</span>
        <a class="underline underline-offset-4" href="/workspace/subscriptions">{subscriptionsCopy.manageSubscription}</a>
      </section>
    {/if}
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
