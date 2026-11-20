<script lang="ts">
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import { detailPageModule } from "@/features/section-detail/lib/detail-page-module.svelte";
import SectionDetailRoute from "../SectionDetailRoute.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
const module = detailPageModule(
  () =>
    import("@/features/section-detail/components/SectionExamSection.svelte"),
);
const SectionExamSection = $derived(module.component);
</script>

<SectionDetailRoute {data} {form}>
  {#snippet content({ data, sectionCopy, displaySection, primaryName, roomMapCopy, sectionExamEvents, fmtDate })}
    <section id="exams" data-detail-tab="exams" class="min-w-0 scroll-mt-4">
      <h2 class="mb-3 text-lg font-semibold tracking-tight">
        {sectionCopy.tabs.exams}
      </h2>
      {#if displaySection.examMode}
        <dl class="mb-3 flex gap-2 text-sm"><dt class="text-muted-foreground">{sectionCopy.examMode}</dt><dd>{primaryName(displaySection.examMode)}</dd></dl>
      {/if}
      {#if SectionExamSection}
        <SectionExamSection
          events={sectionExamEvents}
          fmtDate={fmtDate}
          heading={sectionCopy.tabs.exams}
          roomMapCopy={roomMapCopy}
          pageDemo={data.demo}
          locale={data.locale}
          sectionCopy={sectionCopy}
         />
      {:else}
        <LazyModuleStatus failed={module.failed} heading={sectionCopy.tabs.exams} loadFailed={data.copy.common.error} retry={sectionCopy.pleaseRetry} onRetry={module.retry} />
      {/if}
    </section>
  {/snippet}
</SectionDetailRoute>
