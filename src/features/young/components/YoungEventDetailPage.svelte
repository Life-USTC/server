<script lang="ts">
import type { WorkspacePageCopy } from "@/features/workspace/server/workspace-page-load-types";
import type { YoungEventDetail } from "@/features/young/server/young-event-service";
import PageLayout from "$lib/components/PageLayout.svelte";
import Panel from "$lib/components/Panel.svelte";
import { Button } from "$lib/components/ui/button/index.js";

type Props = {
  copy: WorkspacePageCopy;
  event: YoungEventDetail;
};

let { copy, event }: Props = $props();

const youngCopy = $derived(copy.youngEvents);

function formatDateTime(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return "-";
  return `${formatDateTime(start)} ~ ${formatDateTime(end)}`;
}

const fields = $derived(
  [
    { label: youngCopy.category, value: event.category },
    { label: youngCopy.status, value: event.status },
    { label: youngCopy.registrationStatus, value: event.registrationStatus },
    {
      label: youngCopy.eventTime,
      value: formatRange(event.startAt, event.endAt),
    },
    {
      label: youngCopy.signupWindow,
      value: formatRange(event.applyStartAt, event.applyEndAt),
    },
    { label: youngCopy.location, value: event.location },
    { label: youngCopy.organizer, value: event.organizer },
    { label: youngCopy.department, value: event.department },
    { label: youngCopy.hours, value: event.hours?.toString() },
    {
      label: youngCopy.capacity,
      value:
        event.capacity != null
          ? `${event.appliedCount ?? 0} / ${event.capacity}`
          : null,
    },
  ].filter((field) => field.value != null && field.value !== ""),
);
</script>

<PageLayout description={event.category ?? youngCopy.description} title={event.name}>
  <div class="grid gap-5">
    {#if event.imageUrl}
      <img
        alt={event.name}
        class="max-h-72 w-full rounded-lg object-cover"
        src={event.imageUrl}
      />
    {/if}

    <Panel>
      <dl class="grid gap-4 sm:grid-cols-2">
        {#each fields as field (field.label)}
          <div class="grid gap-1">
            <dt class="text-muted-foreground text-sm">{field.label}</dt>
            <dd class="text-sm font-medium">{field.value}</dd>
          </div>
        {/each}
      </dl>
    </Panel>

    <p class="text-muted-foreground text-sm">{youngCopy.signupHint}</p>

    <div class="flex flex-wrap gap-3">
      <Button
        href="https://young.ustc.edu.cn"
        rel="noreferrer"
        target="_blank"
      >
        {youngCopy.signupCta}
      </Button>
      <Button href="/catalog/young-events" variant="outline">
        {youngCopy.backToList}
      </Button>
    </div>
  </div>
</PageLayout>
