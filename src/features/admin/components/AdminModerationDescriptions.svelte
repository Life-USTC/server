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
import type { AdminModerationFilterControls } from "./admin-moderation-page-types";

export let filterControls: AdminModerationFilterControls;
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

    <ResponsiveCollection>
      {#snippet mobile()}
        <div class="mb-3 flex flex-wrap items-center gap-2" data-slot="collection-header">
          {@render filterControls("search", "mobile")}
          {@render filterControls("author", "mobile")}
          {@render filterControls("editedAt", "mobile")}

          {@render filterControls("descriptionContent", "mobile")}
          {@render filterControls("descriptionTarget", "mobile")}
        </div>
        {#if descriptions.length === 0}<CollectionEmpty variant="compact" description={copy.noDescriptions} />{:else}
        <AdminModerationDescriptionCards
          {copy}
          {descriptions}
          {formatDate}
          {formatMessage}
          manageLabel={copy.manageDescription}
          {onManage}
          {targetLabel}
        />
        {/if}
      {/snippet}
      {#snippet desktop()}
        <AdminModerationDescriptionTable
          {filterControls}
          {copy}
          {descriptionTargetHref}
          {descriptions}
          {formatDate}
          {onManage}
          {targetLabel}
        />
      {/snippet}
    </ResponsiveCollection>
</section>
