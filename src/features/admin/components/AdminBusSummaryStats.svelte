<script lang="ts">
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
    <article class="rounded-xl border border-base-300 bg-base-100 p-4 shadow-sm">
      <div class="text-base-content/60 text-sm">{stat.label()}</div>
      <div class={`mt-1 font-semibold ${stat.valueClass}`}>{stat.getValue()}</div>
      <div class="mt-1 text-base-content/50 text-xs">{stat.getMeta()}</div>
    </article>
  {/each}
</div>
