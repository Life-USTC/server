<script lang="ts">
import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
import type {
  HomeworkDateValue,
  HomeworkDetailModel,
} from "@/features/homeworks/lib/homework-presentation";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Collapsible from "$lib/components/ui/collapsible/index.js";
import type {
  HomeworkDetailCopy,
  HomeworkDetailDateFormatter,
} from "./homework-detail-types";

export let copy: HomeworkDetailCopy;
export let fmtDate: HomeworkDetailDateFormatter;
export let homework: HomeworkDetailModel;

$: detailTags = [
  ...(homework.isMajor ? [copy.tagMajor] : []),
  ...(homework.requiresTeam ? [copy.tagTeam] : []),
];
let detailsOpen = false;

function displayDate(value: HomeworkDateValue) {
  return fmtDate(value);
}
</script>

<section class="min-w-0" data-testid="homework-secondary-details">
  <Collapsible.Root bind:open={detailsOpen} class="group/homework-details rounded-lg bg-muted/40 px-3">
    <Collapsible.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          class="h-10 w-full justify-between px-1 text-left"
          variant="ghost"
        >
          <span class="flex min-w-0 items-center gap-2">
            <span class="shrink-0 font-medium">{copy.moreDetails}</span>
            {#if detailTags.length > 0}
              <span class="text-muted-foreground min-w-0 truncate text-sm font-normal">
                {detailTags.join(" · ")}
              </span>
            {/if}
          </span>
          <ChevronDownIcon
            data-icon="inline-end"
            aria-hidden="true"
            class="shrink-0 transition-transform group-data-[state=open]/homework-details:rotate-180"
          />
        </Button>
      {/snippet}
    </Collapsible.Trigger>
    <Collapsible.Content class="data-[state=closed]:hidden">
      <dl class="grid gap-x-4 gap-y-3 px-1 pb-3 pt-1 sm:grid-cols-2">
        <div>
          <dt class="text-muted-foreground text-xs">{copy.submissionStart}</dt>
          <dd class="mt-1 text-sm font-medium">{displayDate(homework.submissionStartAt)}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground text-xs">{copy.publishedAt}</dt>
          <dd class="mt-1 text-sm font-medium">{displayDate(homework.publishedAt)}</dd>
        </div>
        {#if detailTags.length > 0}
          <div class="flex flex-wrap items-center gap-2 sm:col-span-2">
            <dt class="text-muted-foreground text-xs">{copy.moreDetails}</dt>
            <dd class="flex flex-wrap gap-2">
              {#if homework.isMajor}
                <Badge variant="outline">{copy.tagMajor}</Badge>
              {/if}
              {#if homework.requiresTeam}
                <Badge variant="outline">{copy.tagTeam}</Badge>
              {/if}
            </dd>
          </div>
        {/if}
      </dl>
    </Collapsible.Content>
  </Collapsible.Root>
</section>
