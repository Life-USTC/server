<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import PencilIcon from "@lucide/svelte/icons/pencil";
import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
import Trash2Icon from "@lucide/svelte/icons/trash-2";
import { Button } from "$lib/components/ui/button/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import type {
  SectionHomeworkAction,
  SectionHomeworkCopy,
  SectionHomeworkDisplay,
} from "./section-homework-display-types";

export let canManage: boolean;
export let canWrite: boolean;
export let homework: SectionHomeworkDisplay;
export let homeworkCopy: SectionHomeworkCopy;
export let setDeleteHomeworkTarget: SectionHomeworkAction;
export let startEdit: () => void;
export let toggleHomeworkCompletion: SectionHomeworkAction;
</script>

<!-- Editing section homework is collaborative: any active signed-in user may
     edit, matching `updateHomework`. Only the creator or an admin may delete. -->
{#if canWrite || canManage}
  <div class="grid gap-4">
    <Separator />
    <div class="flex flex-wrap items-center justify-between gap-2">
      {#if canManage}
        <Button
          type="button"
          variant="destructive"
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
          <Button type="button" variant="outline" onclick={startEdit}>
            <PencilIcon data-icon="inline-start" />
            {homeworkCopy.editAction}
          </Button>
          <Button
            type="button"
            variant="outline"
            onclick={() => {
              toggleHomeworkCompletion(homework);
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
  </div>
{/if}
