<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";

type AdminBusSummaryCopy = {
  statActive: string;
  statActiveMeta: string;
  statCampuses: string;
  statCampusesMeta: string;
  statNone: string;
  statRoutes: string;
  statRoutesMeta: string;
  statVersions: string;
  statVersionsMeta: string;
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
    getMeta: () => copy.statVersionsMeta,
    getValue: () => summary.versions,
    label: () => copy.statVersions,
    valueClass: "text-2xl tabular-nums",
  },
  {
    getMeta: () => copy.statActiveMeta,
    getValue: () => summary.active ?? copy.statNone,
    label: () => copy.statActive,
    valueClass: "truncate text-base",
  },
  {
    getMeta: () => copy.statCampusesMeta,
    getValue: () => summary.campuses,
    label: () => copy.statCampuses,
    valueClass: "text-2xl tabular-nums",
  },
  {
    getMeta: () => copy.statRoutesMeta,
    getValue: () => summary.routes,
    label: () => copy.statRoutes,
    valueClass: "text-2xl tabular-nums",
  },
];
</script>

<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  {#each stats as stat}
    <Card.Root size="sm">
      <Card.Header>
        <Card.Description>{stat.label()}</Card.Description>
        <Card.Title class={stat.valueClass}>{stat.getValue()}</Card.Title>
      </Card.Header>
      <Card.Content>
        <p class="text-muted-foreground text-xs">{stat.getMeta()}</p>
      </Card.Content>
    </Card.Root>
  {/each}
</div>
