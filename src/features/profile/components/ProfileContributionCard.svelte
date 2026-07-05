<script lang="ts">
import type { ProfileCopy } from "@/features/profile/lib/profile-copy";
import type { AppLocale } from "@/i18n/config";
import * as Card from "$lib/components/ui/card/index.js";
import ProfileContributionFooter from "./ProfileContributionFooter.svelte";
import ProfileContributionHeatmap from "./ProfileContributionHeatmap.svelte";
import type {
  ContributionCell,
  ProfileStat,
} from "./profile-contribution-types";

export let copy: ProfileCopy["publicProfile"];
export let dateFormatter: Intl.DateTimeFormat;
export let locale: AppLocale;
export let stats: ProfileStat[];
export let totalContributions: number;
export let weeks: ContributionCell[][];

$: monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
$: monthLabels = weeks.map((week, index) => {
  const firstDay = week[0]?.date;
  if (!firstDay) return "";
  const date = new Date(firstDay);
  const previousDay = weeks[index - 1]?.[0]?.date;
  if (!previousDay) return monthFormatter.format(date);
  const previous = new Date(previousDay);
  return date.getMonth() === previous.getMonth()
    ? ""
    : monthFormatter.format(date);
});

const contributionLegend = [
  { label: "0", className: "bg-muted" },
  { label: "1", className: "bg-success/25" },
  { label: "2-3", className: "bg-success/45" },
  { label: "4-6", className: "bg-success/70" },
  { label: "7+", className: "bg-success" },
];

function heatmapClass(count: number) {
  if (count <= 0) return "bg-muted";
  if (count === 1) return "bg-success/25";
  if (count <= 3) return "bg-success/45";
  if (count <= 6) return "bg-success/70";
  return "bg-success";
}
</script>

<Card.Root class="min-w-0">
  <Card.Header>
    <Card.Title>
      {copy.contribution.title.replace(
        "{count}",
        String(totalContributions),
      )}
    </Card.Title>
    <Card.Description class="mt-2">
      {copy.contribution.description}
    </Card.Description>
  </Card.Header>

  <Card.Content class="grid gap-5">
    <ProfileContributionHeatmap
      cellLabel={copy.contribution.cell}
      {dateFormatter}
      {heatmapClass}
      {monthLabels}
      {weeks}
    />

    <ProfileContributionFooter {contributionLegend} {copy} {stats} />

    {#if totalContributions === 0}
      <p class="text-muted-foreground text-sm">
        {copy.contribution.empty}
      </p>
    {/if}
  </Card.Content>
</Card.Root>
