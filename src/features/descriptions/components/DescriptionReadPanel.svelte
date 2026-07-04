<script lang="ts">
import { formatDescriptionCopy } from "@/features/descriptions/lib/description-card-actions";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import * as Empty from "$lib/components/ui/empty/index.js";
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

function handlePanelTabChange(value: string) {
  if (value === "description" || value === "history") {
    activePanelTab = value;
  }
}
</script>

<Tabs.Root value={activePanelTab} onValueChange={handlePanelTabChange}>
  <Tabs.List aria-label={copy.title}>
    <Tabs.Trigger value="description">
      {copy.title}
    </Tabs.Trigger>
    <Tabs.Trigger value="history">
      {formatDescriptionCopy(copy.historyTitle, { count: String(history.length) })}
    </Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="history">
    <DescriptionHistoryList {copy} {formatDate} {history} />
  </Tabs.Content>

  <Tabs.Content value="description">
    {#if description.content}
      <MarkdownPreview
        content={description.content}
        remarkPlugins={campusReferenceMarkdownPlugins}
      />
    {:else}
      <Empty.Root class="min-h-24 border">
        <Empty.Header>
          <Empty.Title>{copy.empty}</Empty.Title>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Tabs.Content>
</Tabs.Root>
