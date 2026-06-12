<script lang="ts">
import type { ProfileCopy } from "@/lib/profile-copy";
import type { ProfileStat } from "./profile-contribution-types";

type LegendItem = {
  className: string;
  label: string;
};

export let contributionLegend: LegendItem[];
export let copy: ProfileCopy["publicProfile"];
export let stats: ProfileStat[];
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
  <div class="flex flex-wrap gap-2">
    {#each stats.slice(1) as stat}
      <span class="rounded-md border border-base-300 bg-base-200/40 px-2 py-1 text-base-content/70 text-xs">
        <span class="font-semibold text-base-content">{stat.value}</span>
        {" "}
        {stat.label}
      </span>
    {/each}
  </div>
  <div class="flex flex-wrap items-center justify-end gap-2 text-base-content/60 text-xs">
    <span>{copy.contribution.less}</span>
    {#each contributionLegend as item}
      <span
        aria-label={item.label}
        class={`h-3 w-3 rounded-[2px] ${item.className}`}
        title={item.label}
      ></span>
    {/each}
    <span>{copy.contribution.more}</span>
  </div>
</div>
