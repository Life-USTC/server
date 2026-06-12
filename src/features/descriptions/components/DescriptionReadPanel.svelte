<script lang="ts">
import { formatDescriptionCopy } from "@/features/descriptions/lib/description-card-actions";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
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
</script>

<Tabs.Root>
  <Tabs.List>
    <Tabs.Button selected={activePanelTab === "description"} onclick={() => (activePanelTab = "description")}>{copy.title}</Tabs.Button>
    <Tabs.Button selected={activePanelTab === "history"} onclick={() => (activePanelTab = "history")}>
      {formatDescriptionCopy(copy.historyTitle, { count: String(history.length) })}
    </Tabs.Button>
  </Tabs.List>

  {#if activePanelTab === "history"}
    <DescriptionHistoryList {copy} {formatDate} {history} />
  {:else if description.content}
    <MarkdownPreview content={description.content} />
  {:else}
    <Alert>{copy.empty}</Alert>
  {/if}
</Tabs.Root>
