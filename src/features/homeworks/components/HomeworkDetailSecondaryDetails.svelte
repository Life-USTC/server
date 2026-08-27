<script lang="ts">
import type {
  HomeworkDateValue,
  HomeworkDetailModel,
} from "@/features/homeworks/lib/homework-presentation";
import * as Accordion from "$lib/components/ui/accordion/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
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

function displayDate(value: HomeworkDateValue) {
  return fmtDate(value);
}
</script>

<section class="min-w-0" data-testid="homework-secondary-details">
  <Accordion.Root type="single" class="border-y">
    <Accordion.Item value="details" class="border-0">
      <Accordion.Trigger class="min-h-11 rounded-none px-0 py-4 hover:no-underline">
        <span class="font-semibold">{copy.moreDetails}</span>
        {#if detailTags.length > 0}
          <span class="text-muted-foreground min-w-0 truncate text-sm font-normal">
            {detailTags.join(" · ")}
          </span>
        {/if}
      </Accordion.Trigger>
      <Accordion.Content class="pb-4">
        <dl class="grid gap-4 pt-2 sm:grid-cols-2">
          <div>
            <dt class="text-muted-foreground text-xs">{copy.submissionStart}</dt>
            <dd class="mt-1 text-sm font-medium">{displayDate(homework.submissionStartAt)}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">{copy.publishedAt}</dt>
            <dd class="mt-1 text-sm font-medium">{displayDate(homework.publishedAt)}</dd>
          </div>
          {#if detailTags.length > 0}
            <div class="sm:col-span-2">
              <dt class="text-muted-foreground text-xs">{copy.moreDetails}</dt>
              <dd class="mt-2 flex flex-wrap gap-2">
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
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
</section>
