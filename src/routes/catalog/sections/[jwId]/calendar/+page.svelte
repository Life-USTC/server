<script lang="ts">
import CalendarIcon from "@lucide/svelte/icons/calendar";
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import { Button } from "#lib/components/ui/button/index.js";
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
  {#snippet content({ data, sectionCopy, openCalendarDialog, roomMapCopy, sectionCalendarEvents, unscheduledCalendarEvents })}
    <section id="calendar" data-detail-tab="calendar" class="min-w-0 scroll-mt-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold tracking-tight">
          {sectionCopy.tabs.calendar}
        </h2>
        <Button variant="outline" type="button" onclick={openCalendarDialog} disabled={Boolean(data.demo)} title={data.demo?.readOnlyReason}>
          <CalendarIcon data-icon="inline-start" />
          {sectionCopy.addToCalendar}
        </Button>
      </div>
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
