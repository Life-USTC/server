<script lang="ts">
import { diffWords } from "diff";
import type {
  DescriptionHistoryItem,
  EditorSummary,
} from "@/features/descriptions/lib/description-payload-types";
import * as Empty from "$lib/components/ui/empty/index.js";

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
    return "rounded-sm bg-success/15 text-success";
  }
  if (segment.removed) {
    return "rounded-sm bg-error/15 text-error";
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
  <div class="grid gap-3">
    {#each history as item}
      {@const previousSegments = diffSegments(item.previousContent, item.nextContent, "previous")}
      {@const nextSegments = diffSegments(item.previousContent, item.nextContent, "next")}
      <section class="rounded-md border border-base-300 bg-base-200/40 p-4">
        <div class="flex flex-wrap items-center gap-2 text-base-content/60 text-xs">
          <span class="font-medium text-base-content">{editorName(item.editor)}</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div class="grid gap-1">
            <p class="font-medium text-base-content/60 text-xs">{copy.previousLabel}</p>
            <div class="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-base-300 bg-base-100 p-3 text-xs">
              {#if previousSegments.length > 0}
                {#each previousSegments as segment}
                  <span class={diffSegmentClass(segment)}>{segment.value}</span>
                {/each}
              {:else}
                <span class="text-base-content/50">{copy.emptyValue}</span>
              {/if}
            </div>
          </div>
          <div class="grid gap-1">
            <p class="font-medium text-base-content/60 text-xs">{copy.updatedLabel}</p>
            <div class="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-base-300 bg-base-100 p-3 text-xs">
              {#if nextSegments.length > 0}
                {#each nextSegments as segment}
                  <span class={diffSegmentClass(segment)}>{segment.value}</span>
                {/each}
              {:else}
                <span class="text-base-content/50">{copy.emptyValue}</span>
              {/if}
            </div>
          </div>
        </div>
      </section>
    {/each}
  </div>
{/if}
