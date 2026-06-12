<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import CalendarIcon from "$lib/components/icons/calendar.svelte";
import CheckCircleIcon from "$lib/components/icons/check-circle.svelte";
import LinkIcon from "$lib/components/icons/link-2.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  SectionLocalizedName,
  SectionPrimaryName,
} from "./section-basic-info-types";

type SectionHeaderCommonCopy = {
  home: string;
  sections: string;
};

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
  isSubscribed: boolean;
};

type SubscriptionActionKey = "subscribe" | "unsubscribe";

export let commonCopy: SectionHeaderCommonCopy;
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
  eyebrow={sectionCopy.teachingSection}
>
  {#snippet breadcrumb()}
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item><Breadcrumb.Link href="/">{commonCopy.home}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Link href="/sections">{commonCopy.sections}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Page>{section.code}</Breadcrumb.Page></Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  {/snippet}
  {#snippet actions()}
    <Button variant="outline" type="button" onclick={onOpenCalendar}>
      <CalendarIcon />
      {sectionCopy.addToCalendar}
    </Button>
    {#if viewer.isSubscribed}
      <form
        method="POST"
        action="?/unsubscribe"
        use:enhance={subscriptionAction("unsubscribe")}
      >
        <Button
          variant="outline"
          type="submit"
          disabled={subscriptionPendingAction === "unsubscribe"}
        >
          <CheckCircleIcon />
          {subscriptionPendingAction === "unsubscribe"
            ? sectionCopy.unsubscribing
            : sectionCopy.unsubscribeLabel}
        </Button>
      </form>
    {:else}
      <form method="GET">
        <input name="subscribe" type="hidden" value="1" />
        <Button type="submit" onclick={onOpenSubscribe}>
          <LinkIcon />
          {sectionCopy.subscribeLabel}
        </Button>
      </form>
    {/if}
  {/snippet}
  {#snippet after()}
    <div class="grid gap-4">
      <div class="flex flex-wrap gap-2">
        <Badge class="font-mono" variant="outline">{section.code}</Badge>
        {#if section.semester}<Badge variant="ghost">{section.semester.nameCn}</Badge>{/if}
        {#if section.campus}<Badge variant="ghost">{primaryName(section.campus)}</Badge>{/if}
        {#if section.stdCount !== null || section.limitCount !== null}
          <Badge variant="ghost">{section.stdCount ?? 0} / {section.limitCount ?? notAvailable}</Badge>
        {/if}
      </div>

      {#if formError}
        <Alert variant="destructive">{formError}</Alert>
      {/if}
    </div>
  {/snippet}
</PageHeader>
