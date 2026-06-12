<script lang="ts">
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

<div class="flex justify-end gap-2">
  {#if canManage}
    <Button
      variant="outline"
      type="button"
      onclick={() => {
        if (editing) cancelEdit();
        else startEdit();
      }}
    >
      {editing ? sectionCopy.close : homeworkCopy.editAction}
    </Button>
  {/if}
  {#if canWrite}
    <Button
      variant="outline"
      type="button"
      onclick={() => {
        if (homework) toggleHomeworkCompletion(homework);
      }}
    >
      {homework.completion ? homeworkCopy.markIncomplete : homeworkCopy.markComplete}
    </Button>
  {/if}
  {#if canManage}
    <Button
      class="text-error"
      variant="outline"
      type="button"
      onclick={() => {
        setDeleteHomeworkTarget(homework);
      }}
    >
      {homeworkCopy.deleteAction}
    </Button>
  {/if}
</div>
