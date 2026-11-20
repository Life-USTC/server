<script lang="ts">
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import { detailPageModule } from "@/features/section-detail/lib/detail-page-module.svelte";
import SectionDetailRoute from "../SectionDetailRoute.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
const module = detailPageModule(
  () =>
    import("@/features/section-detail/components/SectionCalendarTab.svelte"),
);
const SectionCalendarTab = $derived(module.component);
</script>

<SectionDetailRoute {data} {form}>
  {#snippet content({ data, sectionCopy, displaySection, primaryName, periodDetailRows, roomMapCopy, sectionCalendarEvents, unscheduledCalendarEvents })}
    <section id="calendar" data-detail-tab="calendar" class="min-w-0 scroll-mt-4">
      <h2 class="mb-2 text-lg font-semibold tracking-tight">{sectionCopy.tabs.calendar}</h2>
      <dl class="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {#if displaySection.period != null || displaySection.actualPeriods != null}
          <div class="flex gap-2"><dt class="text-muted-foreground">{sectionCopy.period}</dt><dd>{displaySection.period ?? "—"} / {displaySection.actualPeriods ?? "—"}</dd></div>
        {/if}
        {#if displaySection.timesPerWeek != null || displaySection.periodsPerWeek != null}
          <div class="flex gap-2"><dt class="text-muted-foreground">{sectionCopy.periodsPerWeek}</dt><dd>{displaySection.timesPerWeek ?? "—"} x {displaySection.periodsPerWeek ?? "—"}</dd></div>
        {/if}
        {#each periodDetailRows as [label, value]}
          <div class="flex gap-2"><dt class="text-muted-foreground">{label}</dt><dd>{value}</dd></div>
        {/each}
        {#if displaySection.roomType}
          <div class="flex gap-2"><dt class="text-muted-foreground">{sectionCopy.roomType}</dt><dd>{primaryName(displaySection.roomType)}</dd></div>
        {/if}
        {#if displaySection.scheduleRemark?.trim()}
          <div class="flex gap-2"><dt class="shrink-0 text-muted-foreground">{sectionCopy.scheduleRemark}</dt><dd class="whitespace-pre-wrap">{displaySection.scheduleRemark}</dd></div>
        {/if}
      </dl>
      {#if SectionCalendarTab}
        <SectionCalendarTab
          roomMapCopy={roomMapCopy}
          pageDemo={data.demo}
          locale={data.locale}
          sectionCalendarEvents={sectionCalendarEvents}
          sectionCopy={sectionCopy}
          unscheduledCalendarEvents={unscheduledCalendarEvents}
         />
      {:else}
        <LazyModuleStatus failed={module.failed} heading={sectionCopy.tabs.calendar} loadFailed={data.copy.common.error} retry={sectionCopy.pleaseRetry} onRetry={module.retry} />
      {/if}
    </section>
  {/snippet}
</SectionDetailRoute>
