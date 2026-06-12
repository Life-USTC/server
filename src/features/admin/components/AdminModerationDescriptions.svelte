<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import AdminModerationDescriptionCards from "./AdminModerationDescriptionCards.svelte";
import AdminModerationDescriptionSummary from "./AdminModerationDescriptionSummary.svelte";
import AdminModerationDescriptionTable from "./AdminModerationDescriptionTable.svelte";
import type {
  AdminModerationDescription,
  AdminModerationDescriptionCopy,
  AdminModerationDescriptionOption,
} from "./admin-moderation-description-types";

export let copy: AdminModerationDescriptionCopy;
export let descriptionContentOptions: AdminModerationDescriptionOption[];
export let descriptionTargetOptions: AdminModerationDescriptionOption[];
export let descriptions: AdminModerationDescription[];
export let descriptionContentFilter: string | null | undefined;
export let descriptionTargetFilter: string | null | undefined;
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

<section class="grid gap-3">
  <AdminModerationDescriptionSummary
    {copy}
    {descriptionContentFilter}
    {descriptionContentOptions}
    {descriptionTargetFilter}
    {descriptionTargetOptions}
    count={descriptions.length}
    {formatMessage}
  />

  {#if descriptions.length > 0}
    <AdminModerationDescriptionCards
      {copy}
      {descriptions}
      {formatDate}
      {formatMessage}
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
    <Alert>{copy.noDescriptions}</Alert>
  {/if}
</section>
