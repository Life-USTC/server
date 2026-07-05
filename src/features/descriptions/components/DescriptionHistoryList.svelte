<script lang="ts">
import { diffWords } from "diff";
import type {
  DescriptionHistoryItem,
  EditorSummary,
} from "@/features/descriptions/lib/description-payload-types";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";

type DiffMode = "previous" | "next";
type DiffSegment = {
  added?: boolean;
  removed?: boolean;
  value: string;
};

export let copy: {
  editorUnknown: string;
  emptyValue: string;
  historyEmpty: string;
  previousLabel: string;
  updatedLabel: string;
};
export let formatDate: (value: string | null | undefined) => string;
export let history: DescriptionHistoryItem[];

function editorName(editor: EditorSummary | null) {
  return editor?.name ?? editor?.username ?? copy.editorUnknown;
}

function diffSegments(
  previous: string | null,
  next: string,
  mode: DiffMode,
): DiffSegment[] {
  return diffWords(previous ?? "", next).filter((segment) =>
    mode === "previous" ? !segment.added : !segment.removed,
  );
}

function diffSegmentClass(segment: DiffSegment) {
  if (segment.added) {
    return "rounded-sm bg-primary/10 text-primary";
  }
  if (segment.removed) {
    return "rounded-sm bg-destructive/10 text-destructive";
  }
  return "";
}
</script>

{#if history.length === 0}
  <Empty.Root>
    <Empty.Header>
      <Empty.Description>{copy.historyEmpty}</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{:else}
  <Item.Group>
    {#each history as item}
      {@const previousSegments = diffSegments(item.previousContent, item.nextContent, "previous")}
      {@const nextSegments = diffSegments(item.previousContent, item.nextContent, "next")}
      <Item.Root variant="outline" class="items-start">
        <Item.Header>
          <Item.Content class="gap-0">
            <Item.Title>{editorName(item.editor)}</Item.Title>
            <Item.Description class="text-xs">{formatDate(item.createdAt)}</Item.Description>
          </Item.Content>
        </Item.Header>
        <div class="grid w-full gap-3 sm:grid-cols-2">
          <Item.Root variant="muted" size="sm" class="items-start">
            <Item.Content class="gap-2">
              <Item.Title class="text-muted-foreground text-xs">{copy.previousLabel}</Item.Title>
              <ScrollArea class="h-fit max-h-40 rounded-md bg-background">
                <div class="whitespace-pre-wrap p-3 text-xs">
                {#if previousSegments.length > 0}
                  {#each previousSegments as segment}
                    <span class={diffSegmentClass(segment)}>{segment.value}</span>
                  {/each}
                {:else}
                  <span class="text-muted-foreground">{copy.emptyValue}</span>
                {/if}
                </div>
              </ScrollArea>
            </Item.Content>
          </Item.Root>
          <Item.Root variant="muted" size="sm" class="items-start">
            <Item.Content class="gap-2">
              <Item.Title class="text-muted-foreground text-xs">{copy.updatedLabel}</Item.Title>
              <ScrollArea class="h-fit max-h-40 rounded-md bg-background">
                <div class="whitespace-pre-wrap p-3 text-xs">
                {#if nextSegments.length > 0}
                  {#each nextSegments as segment}
                    <span class={diffSegmentClass(segment)}>{segment.value}</span>
                  {/each}
                {:else}
                  <span class="text-muted-foreground">{copy.emptyValue}</span>
                {/if}
                </div>
              </ScrollArea>
            </Item.Content>
          </Item.Root>
        </div>
      </Item.Root>
    {/each}
  </Item.Group>
{/if}
