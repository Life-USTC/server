<script lang="ts">
import { formatDescriptionCopy } from "@/features/descriptions/lib/description-card-actions";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  DescriptionContent,
  DescriptionCopy,
  DescriptionViewer,
} from "./description-component-types";

export let copy: DescriptionCopy;
export let description: DescriptionContent;
export let showTitle = true;
export let showAction = true;
export let editing: boolean;
export let editorName: (value: DescriptionContent["lastEditedBy"]) => string;
export let formatDate: (value: string | null | undefined) => string;
export let onStartEdit: () => void;
export let viewer: DescriptionViewer;
</script>

{#if showTitle || showAction || description.lastEditedAt}
  <div
    class="flex flex-wrap items-start gap-3"
    class:justify-between={showTitle || description.lastEditedAt}
    class:justify-end={!showTitle && !description.lastEditedAt}
  >
    <div class="grid min-w-0 gap-1">
      {#if showTitle}
        <h3 class="min-w-0 break-words text-base font-medium leading-snug">
          {copy.title}
        </h3>
      {/if}
      {#if description.lastEditedAt}
        <p class="text-muted-foreground text-sm">
          {formatDescriptionCopy(copy.lastEdited, {
            date: formatDate(description.lastEditedAt),
          })}
          ·
          {formatDescriptionCopy(copy.editedBy, {
            name: editorName(description.lastEditedBy),
          })}
        </p>
      {/if}
    </div>
    {#if showAction}
      {#if viewer.isAuthenticated && !viewer.isSuspended && !editing}
        <Button
          data-testid="description-edit"
          type="button"
          variant="outline"
          onclick={onStartEdit}
        >
          {copy.edit}
        </Button>
      {:else if !viewer.isAuthenticated}
        <Button
          data-testid="description-edit-login"
          href="/account/sign-in"
          variant="outline"
        >
          {copy.loginToEdit}
        </Button>
      {/if}
    {/if}
  </div>
{/if}
