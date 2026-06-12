<script lang="ts">
import * as Tabs from "$lib/components/ui/tabs/index.js";
import type { CatalogDetailTab } from "../lib/catalog-detail-navigation";

export let activeTab: CatalogDetailTab;
export let commentsLabel: string;
export let sectionsLabel: string;
export let setActiveTab: (tab: CatalogDetailTab) => void;
</script>

<Tabs.Root aria-label={sectionsLabel}>
  <Tabs.List>
    <Tabs.Button
      selected={activeTab === "sections"}
      onclick={() => setActiveTab("sections")}
    >
      {sectionsLabel}
    </Tabs.Button>
    <Tabs.Button
      selected={activeTab === "comments"}
      onclick={() => setActiveTab("comments")}
    >
      {commentsLabel}
    </Tabs.Button>
  </Tabs.List>
</Tabs.Root>
