<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import PencilIcon from "@lucide/svelte/icons/pencil";
import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
import Trash2Icon from "@lucide/svelte/icons/trash-2";
import XIcon from "@lucide/svelte/icons/x";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  SectionHomeworkAction,
  SectionHomeworkCopy,
  SectionHomeworkDisplay,
  SectionHomeworkSectionCopy,
} from "./section-homework-display-types";

export let canManage: boolean;
export let canWrite: boolean;
export let cancelEdit: () => void;
export let editing: boolean;
export let homework: SectionHomeworkDisplay;
export let homeworkCopy: SectionHomeworkCopy;
export let sectionCopy: SectionHomeworkSectionCopy;
export let setDeleteHomeworkTarget: SectionHomeworkAction;
export let startEdit: () => void;
export let toggleHomeworkCompletion: SectionHomeworkAction;
</script>

{#if canWrite || canManage}
  <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
    <!-- Editing section homework is collaborative: any active signed-in user may
         edit, matching `updateHomework`. Only the creator or an admin may delete. -->
    {#if canManage}
      <Button
        variant="destructive"
        type="button"
        onclick={() => {
          setDeleteHomeworkTarget(homework);
        }}
      >
        <Trash2Icon data-icon="inline-start" />
        {homeworkCopy.deleteAction}
      </Button>
    {/if}

    {#if canWrite}
      <div class="ml-auto flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          type="button"
          onclick={() => {
            if (editing) cancelEdit();
            else startEdit();
          }}
        >
          {#if editing}
            <XIcon data-icon="inline-start" />
          {:else}
            <PencilIcon data-icon="inline-start" />
          {/if}
          {editing ? sectionCopy.close : homeworkCopy.editAction}
        </Button>
        <Button
          variant={homework.completion ? "outline" : "default"}
          type="button"
          onclick={() => {
            if (homework) toggleHomeworkCompletion(homework);
          }}
        >
          {#if homework.completion}
            <RotateCcwIcon data-icon="inline-start" />
          {:else}
            <CheckCircleIcon data-icon="inline-start" />
          {/if}
          {homework.completion ? homeworkCopy.markIncomplete : homeworkCopy.markComplete}
        </Button>
      </div>
    {/if}
  </div>
{/if}
