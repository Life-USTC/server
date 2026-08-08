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
import { Separator } from "$lib/components/ui/separator/index.js";

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
  <!-- Same reading order as the homework popup: content, due summary, vertical
       metadata, then action controls. -->
  <DetailDialog onClose={onClose} title={selected.title}>
    {#snippet body()}
      <Item.Root variant="outline" class="items-start">
        <Item.Content>
          {#if selected.content}
            <MarkdownPreview class="text-sm" content={selected.content} />
          {:else}
            <Item.Description>{todosCopy.contentPlaceholder}</Item.Description>
          {/if}
        </Item.Content>
      </Item.Root>

      <Item.Root variant="muted" class="items-start">
        <Item.Header>
          <Item.Content>
            <Item.Description>{todosCopy.dueLabel}</Item.Description>
            <Item.Title class="text-base tabular-nums">{fmtDate(selected.dueAt)}</Item.Title>
          </Item.Content>
          <Item.Actions>
            <Badge variant={selected.completed ? "default" : "secondary"}>
              {todoStatus(selected)}
            </Badge>
          </Item.Actions>
        </Item.Header>
      </Item.Root>

      <dl class="divide-y rounded-lg border">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2.5">
          <dt class="text-muted-foreground text-xs">{todosCopy.priorityLabel}</dt>
          <dd>
            <Badge
              variant={selected.priority === "high"
                ? "destructive"
                : selected.priority === "medium"
                  ? "secondary"
                  : "outline"}
            >
              {todosCopy.priority[selected.priority]}
            </Badge>
          </dd>
        </div>
      </dl>

      <div class="grid gap-4">
        <Separator />
        <div class="flex flex-wrap items-center justify-between gap-2">
          <Button
            aria-label={todosCopy.deleteAriaLabel}
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
          <div class="ml-auto flex flex-wrap justify-end gap-2">
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
              variant="outline"
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
          </div>
        </div>
      </div>
    {/snippet}
  </DetailDialog>
{/if}
