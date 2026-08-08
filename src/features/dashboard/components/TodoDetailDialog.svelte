<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import PencilIcon from "@lucide/svelte/icons/pencil";
import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
import Trash2 from "@lucide/svelte/icons/trash-2";
import type {
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import DetailDialog from "$lib/components/DetailDialog.svelte";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";

export let deleteTodo: (todo: DashboardTodoItem) => void;
export let fmtDate: (value: string | Date | null | undefined) => string;
export let onClose: () => void;
export let openTodoEditor: (todo: DashboardTodoItem) => void;
export let todo: DashboardTodoItem | null;
export let todoActionLabel: (todo: DashboardTodoItem) => string;
export let todoSavingById: Record<string, boolean>;
export let todosCopy: DashboardTodosCopy;
export let todoStatus: (todo: DashboardTodoItem) => string;
export let toggleTodoCompletion: (todo: DashboardTodoItem) => void;
</script>

{#if todo}
  {@const selected = todo}
  <DetailDialog
    onClose={onClose}
    subtitle={`${todosCopy.dueLabel} · ${fmtDate(selected.dueAt)}`}
    title={selected.title}
  >
    {#snippet badges()}
      <Badge
        variant={selected.priority === "high"
          ? "destructive"
          : selected.priority === "medium"
            ? "secondary"
            : "outline"}
      >
        {todosCopy.priority[selected.priority]}
      </Badge>
      <Badge variant={selected.completed ? "default" : "outline"}>
        {todoStatus(selected)}
      </Badge>
    {/snippet}

    {#snippet body()}
      <Item.Root variant="muted" class="items-start p-4">
        <Item.Content>
          {#if selected.content}
            <MarkdownPreview class="text-sm" content={selected.content} />
          {:else}
            <Item.Description>{todosCopy.contentPlaceholder}</Item.Description>
          {/if}
        </Item.Content>
      </Item.Root>
    {/snippet}

    {#snippet footer()}
      <Button
        aria-label={todosCopy.deleteAriaLabel}
        class="sm:mr-auto"
        disabled={todoSavingById[selected.id]}
        type="button"
        variant="destructive"
        onclick={() => {
          deleteTodo(selected);
        }}
      >
        <Trash2 data-icon="inline-start" />
        {todoSavingById[selected.id] ? todosCopy.saving : todosCopy.delete}
      </Button>
      <Button
        type="button"
        variant="outline"
        onclick={() => {
          openTodoEditor(selected);
        }}
      >
        <PencilIcon data-icon="inline-start" />
        {todosCopy.editTitle}
      </Button>
      <Button
        disabled={todoSavingById[selected.id]}
        type="button"
        variant={selected.completed ? "outline" : "default"}
        onclick={() => {
          toggleTodoCompletion(selected);
        }}
      >
        {#if selected.completed}
          <RotateCcwIcon data-icon="inline-start" />
        {:else}
          <CheckCircleIcon data-icon="inline-start" />
        {/if}
        {todoSavingById[selected.id] ? todosCopy.saving : todoActionLabel(selected)}
      </Button>
    {/snippet}
  </DetailDialog>
{/if}
