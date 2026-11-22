<script lang="ts">
import TeacherIcon from "@lucide/svelte/icons/user-round";
import PageHeader from "#lib/components/PageHeader.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
} from "@/features/catalog/lib/catalog-list-display";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { page } from "$app/state";
import SectionDetailPrimaryActions from "./SectionDetailPrimaryActions.svelte";

type SectionHeaderCopy = {
  addToCalendar: string;
  historicalSectionDescription: string;
  historicalSectionLabel: string;
  subscribeLabel: string;
  subscribeSuccess: string;
  teachingSection: string;
  unsubscribeLabel: string;
  unsubscribing: string;
};

type SectionHeaderSection = {
  code: string;
  teachers?: (CatalogNamed & { id: string | number })[];
  semester?: { nameCn?: string | null } | null;
  retiredAt?: string | Date | null;
};

type SectionHeaderViewer = {
  isSubscribed?: boolean;
  subscriptionKind?: "regular" | "auditor" | "teaching_assistant";
};

export let courseName: string;
export let readOnlyReason: string | undefined = undefined;
export let courseSecondaryName: string;
export let formError: string | null | undefined;
export let onOpenCalendar: () => void;
export let onOpenSubscribe: () => void;
export let section: SectionHeaderSection;
export let sectionCopy: SectionHeaderCopy;
export let viewer: SectionHeaderViewer;
let locale: "en-us" | "zh-cn";
$: locale = page.data.locale === "en-us" ? "en-us" : "zh-cn";
$: hasCourseName = courseName !== section.code;
$: subscriptionsCopy = getWorkspacePageCopy(locale).subscriptions;
</script>

<PageHeader
  title={courseName}
  titleClass={hasCourseName ? "" : "font-mono [overflow-wrap:anywhere]"}
  description={courseSecondaryName}
  actionsClass="hidden self-center md:flex"
  class="gap-1 [&>div:empty]:hidden [&_h1+p]:text-sm"
  density="detail"
>
  {#snippet belowTitle()}
    <div class="mt-1 flex flex-wrap items-baseline gap-x-3 text-sm text-muted-foreground">
      {#if section.semester?.nameCn}<span>{formatSemesterName(locale, section.semester.nameCn)}</span>{/if}
      {#each section.teachers ?? [] as teacher (teacher.id)}
        <a class="inline-block min-h-6 min-w-6 leading-6" href={`/catalog/teachers/${teacher.id}`}><TeacherIcon aria-hidden="true" class="me-1 inline size-4 shrink-0 align-[-0.125em]" />{catalogLocalizedDisplayName(teacher, locale)}</a>
      {/each}
      {#if hasCourseName}<span class="font-mono" data-slot="catalog-code">{section.code}</span>{/if}
    </div>
  {/snippet}
  {#snippet actions()}
    <SectionDetailPrimaryActions
      onOpenCalendar={onOpenCalendar}
      onOpenSubscribe={onOpenSubscribe}
      retired={section.retiredAt != null}
      sectionCopy={sectionCopy}
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
