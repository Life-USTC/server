<script lang="ts">
import AdminModerationDescriptionCards from "./AdminModerationDescriptionCards.svelte";
import AdminModerationDescriptionSummary from "./AdminModerationDescriptionSummary.svelte";
import AdminModerationDescriptionTable from "./AdminModerationDescriptionTable.svelte";
import type {
  AdminModerationDescription,
  AdminModerationDescriptionCopy,
} from "./admin-moderation-description-types";
import type { AdminModerationFilterControls } from "./admin-moderation-page-types";
import ModerationCollection from "./ModerationCollection.svelte";

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

    <ModerationCollection
      {filterControls}
      fields={["search", "author", "editedAt", "descriptionContent", "descriptionTarget"]}
      empty={descriptions.length === 0}
      emptyDescription={copy.noDescriptions}
    >
      {#snippet cards()}
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
          {filterControls}
          {copy}
          {descriptionTargetHref}
          {descriptions}
          {formatDate}
          {onManage}
          {targetLabel}
        />
      {/snippet}
    </ModerationCollection>
</section>
