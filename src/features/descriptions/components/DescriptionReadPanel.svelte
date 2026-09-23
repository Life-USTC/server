<script lang="ts">
import { formatDescriptionCopy } from "@/features/descriptions/lib/description-card-actions";
import RenderedMarkdown from "$lib/components/RenderedMarkdown.svelte";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import DescriptionHistoryList from "./DescriptionHistoryList.svelte";
import type {
  DescriptionContent,
  DescriptionCopy,
  DescriptionHistoryItem,
} from "./description-component-types";

type PanelTab = "description" | "history";

export let activePanelTab: PanelTab;
export let copy: DescriptionCopy;
export let description: DescriptionContent;
export let formatDate: (value: string | null | undefined) => string;
export let history: DescriptionHistoryItem[];

$: showHistoryTabs = history.length > 0;

function handlePanelTabChange(value: string) {
  if (value === "description" || value === "history") {
    activePanelTab = value;
  }
}
</script>

{#if showHistoryTabs}
  <Tabs.Root value={activePanelTab} onValueChange={handlePanelTabChange}>
    <Tabs.List class="w-full" aria-label={copy.title}>
      <Tabs.Trigger class="flex-1" value="description">
        {copy.title}
      </Tabs.Trigger>
      <Tabs.Trigger class="flex-1" value="history">
        {formatDescriptionCopy(copy.historyTitle, { count: String(history.length) })}
      </Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="history">
      <DescriptionHistoryList {copy} {formatDate} {history} />
    </Tabs.Content>

    <Tabs.Content value="description">
      {#if description.content}
        <RenderedMarkdown html={description.renderedHtml} />
      {/if}
    </Tabs.Content>
  </Tabs.Root>
{:else if description.content}
  <RenderedMarkdown html={description.renderedHtml} />
{/if}
