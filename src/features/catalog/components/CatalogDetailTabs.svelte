<script lang="ts">
import * as Tabs from "$lib/components/ui/tabs/index.js";
import type { CatalogDetailTab } from "../lib/catalog-detail-navigation";

export let activeTab: CatalogDetailTab;
export let commentsLabel: string;
export let idPrefix = "catalog-detail";
export let sectionsLabel: string;
export let setActiveTab: (tab: CatalogDetailTab) => void;

$: sectionsTabId = `${idPrefix}-sections-tab`;
$: commentsTabId = `${idPrefix}-comments-tab`;
$: sectionsPanelId = `${idPrefix}-sections-panel`;
$: commentsPanelId = `${idPrefix}-comments-panel`;
</script>

<Tabs.Root aria-label={sectionsLabel}>
  <Tabs.List semantic>
    <Tabs.Button
      id={sectionsTabId}
      panelId={sectionsPanelId}
      semantic
      selected={activeTab === "sections"}
      onclick={() => setActiveTab("sections")}
    >
      {sectionsLabel}
    </Tabs.Button>
    <Tabs.Button
      id={commentsTabId}
      panelId={commentsPanelId}
      semantic
      selected={activeTab === "comments"}
      onclick={() => setActiveTab("comments")}
    >
      {commentsLabel}
    </Tabs.Button>
  </Tabs.List>
</Tabs.Root>
