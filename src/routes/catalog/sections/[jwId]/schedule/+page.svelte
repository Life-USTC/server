<script lang="ts">
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
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="font-semibold">{sectionCopy.tabs.exams}</h2>
          <Button variant="ghost" size="sm" disabled={Boolean(data.demo)} onclick={openCalendarDialog}>{sectionCopy.addToCalendar}</Button>
        </div>
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
        <h2 class="mt-5 mb-2 font-semibold">{data.copy.sectionDetail.classSchedule}</h2>
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
