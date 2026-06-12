<script lang="ts">
import {
  adminModerationDescriptionEditedAt,
  adminModerationDescriptionLastEditor,
} from "./admin-moderation-description-display";
import type {
  AdminModerationDescription,
  AdminModerationDescriptionCopy,
} from "./admin-moderation-description-types";

export let copy: AdminModerationDescriptionCopy;
export let descriptions: AdminModerationDescription[];
export let formatDate: (value: string | Date) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let onManage: (description: AdminModerationDescription) => void;
export let targetLabel: (description: AdminModerationDescription) => string;
</script>

<div class="grid gap-3 md:hidden">
  {#each descriptions as description}
    <button
      class="rounded-md border border-base-300 bg-base-100 p-0 text-left transition hover:border-primary/40 hover:shadow-sm"
      data-slot="card"
      type="button"
      onclick={() => onManage(description)}
    >
      <div class="grid gap-3 p-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-semibold text-lg">{targetLabel(description)}</h2>
          <span class="text-base-content/60 text-sm">
            {formatDate(adminModerationDescriptionEditedAt(description))}
          </span>
        </div>
        <p class="line-clamp-4 whitespace-pre-wrap text-sm">
          {description.content || copy.emptyDescription}
        </p>
        <p class="text-base-content/60 text-xs">
          {formatMessage(copy.lastEditor, {
            name: adminModerationDescriptionLastEditor(description, copy),
          })}
        </p>
      </div>
    </button>
  {/each}
</div>
