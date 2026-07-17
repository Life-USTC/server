<script lang="ts">
import * as Item from "$lib/components/ui/item/index.js";

type AdminBusSummaryCopy = {
  statActive: string;
  statCampuses: string;
  statNone: string;
  statRoutes: string;
  statVersions: string;
};

export let copy: AdminBusSummaryCopy;
export let summary: {
  active?: string | null;
  campuses: number;
  routes: number;
  versions: number;
};

const stats = [
  {
    getValue: () => summary.active ?? copy.statNone,
    label: () => copy.statActive,
    valueClass: "max-w-full truncate text-base",
  },
  {
    getValue: () => summary.versions,
    label: () => copy.statVersions,
    valueClass: "text-xl tabular-nums",
  },
  {
    getValue: () => summary.campuses,
    label: () => copy.statCampuses,
    valueClass: "text-xl tabular-nums",
  },
  {
    getValue: () => summary.routes,
    label: () => copy.statRoutes,
    valueClass: "text-xl tabular-nums",
  },
];
</script>

<Item.Group
  class="grid grid-cols-2 gap-2 lg:grid-cols-4"
  data-testid="admin-bus-summary"
>
  {#each stats as stat}
    <Item.Root size="sm" variant="muted">
      <Item.Content class="min-w-0">
        <Item.Description>{stat.label()}</Item.Description>
        <Item.Title class={stat.valueClass}>{stat.getValue()}</Item.Title>
      </Item.Content>
    </Item.Root>
  {/each}
</Item.Group>
