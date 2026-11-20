<script lang="ts">
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import { detailPageModule } from "@/features/section-detail/lib/detail-page-module.svelte";
import SectionDetailRoute from "../SectionDetailRoute.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
const module = detailPageModule(
  () => import("@/features/descriptions/components/DescriptionCard.svelte"),
);
const DescriptionCard = $derived(module.component);
</script>

<SectionDetailRoute {data} {form}>
  {#snippet content({ data, descriptionData })}
    <section id="introduction" data-detail-tab="introduction" class="scroll-mt-4">
      {#key `description:section:${data.section.id}`}
        {#if DescriptionCard}
          <DescriptionCard
            resolveViewer
            targetType="section"
            targetId={data.section.id}
            initialData={descriptionData}
            locale={data.locale}
            copy={data.copy.descriptions}
            heading={data.copy.descriptions.title}
            showTitle={false}
            readOnlyReason={data.demo?.readOnlyReason}
          />
        {:else}
          <h2 class="mb-3 text-lg font-semibold tracking-tight">
            {data.copy.descriptions.title}
          </h2>
          {#if descriptionData.description.renderedHtml}
            <div class="markdown-preview" data-slot="markdown-preview">
              {@html descriptionData.description.renderedHtml}
            </div>
          {/if}
          {#if module.failed || !descriptionData.description.renderedHtml}
            <LazyModuleStatus failed={module.failed} heading={data.copy.descriptions.title} loadFailed={data.copy.descriptions.loadFailed} retry={data.copy.descriptions.retry} onRetry={module.retry} />
          {/if}
        {/if}
      {/key}
    </section>
  {/snippet}
</SectionDetailRoute>
