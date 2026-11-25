<script lang="ts">
import MoreHorizontalIcon from "@lucide/svelte/icons/more-horizontal";
import { Button } from "#lib/components/ui/button/index.js";
import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
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
       edit, matching `updateHomework`. Only the creator may delete; moderation belongs to the admin surface. -->
  {#if canWrite && editing}
    <Button
      variant="outline"
      onclick={() => {
        cancelEdit();
      }}
    >
      {sectionCopy.close}
    </Button>
  {/if}
  {#if !editing && (canWrite || canManage)}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet render({ props })}
          <Button
            {...props}
            icon={MoreHorizontalIcon}
            aria-label={homeworkCopy.moreDetails}
            class="icon-action"
            size="icon"
            type="button"
            variant="outline"
          />
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Group>
          {#if canWrite}
            <DropdownMenu.Item onSelect={startEdit}>
              {homeworkCopy.editAction}
            </DropdownMenu.Item>
          {/if}
          {#if canWrite && canManage}
            <DropdownMenu.Separator />
          {/if}
          {#if canManage}
            <DropdownMenu.Item
              onSelect={() => setDeleteHomeworkTarget(homework)}
              variant="destructive"
            >
              {homeworkCopy.deleteAction}
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
</div>
