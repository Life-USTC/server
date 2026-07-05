<script lang="ts">
import type { ProfileCopy } from "@/features/profile/lib/profile-copy";
import { Badge } from "$lib/components/ui/badge/index.js";
import { cn } from "$lib/utils.js";
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
      <Badge variant="outline">
        <span class="font-semibold">{stat.value}</span>
        {" "}
        {stat.label}
      </Badge>
    {/each}
  </div>
  <div class="flex flex-wrap items-center justify-end gap-2 text-muted-foreground text-xs">
    <span>{copy.contribution.less}</span>
    {#each contributionLegend as item}
      <span
        aria-label={item.label}
        class={cn("size-3 rounded-[2px]", item.className)}
        title={item.label}
      ></span>
    {/each}
    <span>{copy.contribution.more}</span>
  </div>
</div>
