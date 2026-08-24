<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
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

<div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
  <!-- Editing section homework is collaborative: any active signed-in user may
       edit, matching `updateHomework`. Only the creator or an admin may delete. -->
    {#if canWrite}
      <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <Button
        class="w-full sm:w-auto"
        type="button"
        onclick={() => {
          if (homework) toggleHomeworkCompletion(homework);
        }}
      >
        {homework.completion ? homeworkCopy.markIncomplete : homeworkCopy.markComplete}
      </Button>
      <Button
        class="w-full sm:w-auto"
        variant="outline"
        type="button"
        onclick={() => {
          if (editing) cancelEdit();
          else startEdit();
        }}
      >
        {editing ? sectionCopy.close : homeworkCopy.editAction}
      </Button>
      </div>
    {/if}
    {#if canManage}
      <Separator class="sm:hidden" />
      <Separator class="hidden sm:block" orientation="vertical" />
      <div class="sm:ml-auto">
        <Button
          class="w-full sm:w-auto"
          variant="destructive"
          type="button"
          onclick={() => {
            setDeleteHomeworkTarget(homework);
          }}
        >
          {homeworkCopy.deleteAction}
        </Button>
      </div>
    {/if}
</div>
