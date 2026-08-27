<script lang="ts">
import MoreHorizontalIcon from "@lucide/svelte/icons/more-horizontal";
import PencilIcon from "@lucide/svelte/icons/pencil";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
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
</script>

<div class="flex items-center gap-2">
  <!-- Editing section homework is collaborative: any active signed-in user may
       edit, matching `updateHomework`. Only the creator or an admin may delete. -->
  {#if canWrite}
      <Button
        class="min-h-11 sm:min-h-9"
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
  {#if canManage}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            aria-label={homeworkCopy.moreDetails}
            class="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9"
            size="icon"
            type="button"
            variant="outline"
          >
            <MoreHorizontalIcon />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Group>
          <DropdownMenu.Item onSelect={startEdit}>
            <PencilIcon />
            {homeworkCopy.editAction}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            onSelect={() => setDeleteHomeworkTarget(homework)}
            variant="destructive"
          >
            {homeworkCopy.deleteAction}
          </DropdownMenu.Item>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
</div>
