<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import type {
  DashboardHomeworkDetailAction,
  DashboardHomeworkDetailCopy,
  DashboardHomeworkDetailFormatter,
  DashboardHomeworkDetailItem,
} from "./dashboard-homework-detail-types";

export let fmtDate: DashboardHomeworkDetailFormatter;
export let homework: DashboardHomeworkDetailItem;
export let homeworkEtaLabel: DashboardHomeworkDetailFormatter;
export let homeworksCopy: DashboardHomeworkDetailCopy;
export let homeworkStatus: DashboardHomeworkDetailAction;
</script>

<Item.Root variant="muted" class="items-start">
  <Item.Header>
    <Item.Content>
      <Item.Description class="text-xs uppercase tracking-normal">
        {homeworksCopy.submissionDue}
      </Item.Description>
      <Item.Title class="text-lg">{fmtDate(homework.submissionDueAt)}</Item.Title>
    </Item.Content>
    <Item.Actions>
      <Badge variant={homework.completion ? "default" : "secondary"}>
        {homeworkStatus(homework)}
      </Badge>
    </Item.Actions>
  </Item.Header>
  <Item.Description>{homeworkEtaLabel(homework.submissionDueAt)}</Item.Description>
  <Separator />
  <Item.Group class="grid gap-3 sm:grid-cols-2">
    <Item.Root variant="outline" size="sm">
      <Item.Content>
        <Item.Description class="text-xs">{homeworksCopy.submissionStart}</Item.Description>
        <Item.Title>{fmtDate(homework.submissionStartAt)}</Item.Title>
      </Item.Content>
    </Item.Root>
    <Item.Root variant="outline" size="sm">
      <Item.Content>
        <Item.Description class="text-xs">{homeworksCopy.homeworkPublishedAt}</Item.Description>
        <Item.Title>{fmtDate(homework.publishedAt)}</Item.Title>
      </Item.Content>
    </Item.Root>
  </Item.Group>
</Item.Root>

<div class="flex flex-wrap gap-2">
  {#if homework.isMajor}
    <Badge variant="secondary">
      {homeworksCopy.tagMajor}
    </Badge>
  {/if}
  {#if homework.requiresTeam}
    <Badge variant="outline">
      {homeworksCopy.tagTeam}
    </Badge>
  {/if}
</div>
