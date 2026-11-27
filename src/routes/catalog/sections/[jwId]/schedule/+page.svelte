<script lang="ts">
import CalendarPlusIcon from "@lucide/svelte/icons/calendar-plus";
import { Button } from "#lib/components/ui/button/index.js";
import SectionCalendarTab from "@/features/section-detail/components/SectionCalendarTab.svelte";
import SectionExamSection from "@/features/section-detail/components/SectionExamSection.svelte";
import SectionDetailRoute from "../SectionDetailRoute.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<SectionDetailRoute {data} {form}>
  {#snippet content({ data, sectionCopy, fmtDate, sectionExamEvents, openCalendarDialog, roomMapCopy, sectionCalendarEvents })}
    <section id="schedule" data-detail-tab="schedule" class="min-w-0 scroll-mt-4">
      <section id="exams">
        <h2 class="mb-3 section-heading">{sectionCopy.tabs.exams}</h2>
        <SectionExamSection
          events={sectionExamEvents}
          fmtDate={fmtDate}
          heading={sectionCopy.tabs.exams}
          roomMapCopy={roomMapCopy}
          pageDemo={data.demo}
          locale={data.locale}
          sectionCopy={sectionCopy}
        />
      </section>
      <section id="calendar">
        <div class="mt-5 mb-2 flex items-center justify-between gap-2">
          <h2 class="section-heading">{data.copy.sectionDetail.classSchedule}</h2>
          {#if sectionCalendarEvents.length}
            <Button icon={CalendarPlusIcon} variant="outline" size="sm" disabled={Boolean(data.demo)} onclick={openCalendarDialog}>{sectionCopy.addToCalendar}
            </Button>
          {/if}
        </div>
        <SectionCalendarTab
          roomMapCopy={roomMapCopy}
          pageDemo={data.demo}
          locale={data.locale}
          sectionCalendarEvents={sectionCalendarEvents}
          sectionCopy={sectionCopy}
        />
      </section>
    </section>
  {/snippet}
</SectionDetailRoute>
