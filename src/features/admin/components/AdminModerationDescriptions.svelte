<script lang="ts">
import * as Empty from "$lib/components/ui/empty/index.js";
import AdminModerationDescriptionCards from "./AdminModerationDescriptionCards.svelte";
import AdminModerationDescriptionSummary from "./AdminModerationDescriptionSummary.svelte";
import AdminModerationDescriptionTable from "./AdminModerationDescriptionTable.svelte";
import type {
  AdminModerationDescription,
  AdminModerationDescriptionCopy,
} from "./admin-moderation-description-types";

export let copy: AdminModerationDescriptionCopy;
export let descriptions: AdminModerationDescription[];
export let descriptionTargetHref: (
  description: AdminModerationDescription,
) => string;
export let formatDate: (value: string | Date) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let onManage: (description: AdminModerationDescription) => void;
export let targetLabel: (description: AdminModerationDescription) => string;
</script>

<section class="grid grid-cols-[minmax(0,1fr)] gap-3">
  <AdminModerationDescriptionSummary
    {copy}
    count={descriptions.length}
    {formatMessage}
  />

  {#if descriptions.length > 0}
    <AdminModerationDescriptionCards
      {copy}
      {descriptions}
      {formatDate}
      {formatMessage}
      manageLabel={copy.manageDescription}
      {onManage}
      {targetLabel}
    />
    <AdminModerationDescriptionTable
      {copy}
      {descriptionTargetHref}
      {descriptions}
      {formatDate}
      {onManage}
      {targetLabel}
    />
  {:else}
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{copy.noDescriptions}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</section>
