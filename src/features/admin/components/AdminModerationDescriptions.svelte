<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
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
    <ResponsiveCollection>
      {#snippet mobile()}
        <AdminModerationDescriptionCards
          {copy}
          {descriptions}
          {formatDate}
          {formatMessage}
          manageLabel={copy.manageDescription}
          {onManage}
          {targetLabel}
        />
      {/snippet}
      {#snippet desktop()}
        <AdminModerationDescriptionTable
          {copy}
          {descriptionTargetHref}
          {descriptions}
          {formatDate}
          {onManage}
          {targetLabel}
        />
      {/snippet}
    </ResponsiveCollection>
  {:else}
    <CollectionEmpty variant="compact" description={copy.noDescriptions} />
  {/if}
</section>
