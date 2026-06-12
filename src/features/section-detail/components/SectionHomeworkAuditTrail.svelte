<script lang="ts">
import * as Accordion from "$lib/components/ui/accordion/index.js";
import type {
  SectionHomeworkAuditLog,
  SectionHomeworkCommonCopy,
  SectionHomeworkCopy,
  SectionHomeworkFormatter,
} from "./section-homework-display-types";

export let commonCopy: SectionHomeworkCommonCopy;
export let fmtDateTime: SectionHomeworkFormatter;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let homeworkAuditActionLabel: (action: string) => string;
export let homeworkCopy: SectionHomeworkCopy;
export let logs: SectionHomeworkAuditLog[];
</script>

{#if logs.length > 0}
  <Accordion.Item title={homeworkCopy.contentHistoryAction}>
    <div class="grid gap-2">
      {#each logs.slice(0, 5) as log}
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3 text-sm">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-medium">{homeworkAuditActionLabel(log.action)}</span>
            <span class="text-base-content/60 text-xs">{fmtDateTime(log.createdAt)}</span>
          </div>
          <p class="mt-1 text-base-content/60">{log.titleSnapshot}</p>
          {#if log.actor}
            <p class="mt-1 text-base-content/50 text-xs">
              {formatMessage(homeworkCopy.contentHistoryActor, {
                name: log.actor.name ?? log.actor.username ?? commonCopy.unknown,
              })}
            </p>
          {/if}
        </div>
      {/each}
    </div>
  </Accordion.Item>
{/if}
