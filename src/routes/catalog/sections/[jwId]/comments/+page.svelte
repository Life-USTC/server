<script lang="ts">
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import { detailPageModule } from "@/features/section-detail/lib/detail-page-module.svelte";
import SectionDetailRoute from "../SectionDetailRoute.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
const module = detailPageModule(
  () => import("@/features/comments/components/CommentsPanel.svelte"),
);
const CommentsPanel = $derived(module.component);
</script>

<SectionDetailRoute {data} {form}>
  {#snippet content({ data, sectionCopy, commentTargets })}
    <section id="comments" data-detail-tab="comments" class="scroll-mt-4 min-w-0">
      {#key `comments:section:${data.section.id}`}
        {#if CommentsPanel}
          <CommentsPanel
            initialData={data.commentsData}
            targetType="section"
            targetId={data.section.id}
            targets={commentTargets}
            showAllTargets
            heading={sectionCopy.tabs.comments}
            readOnlyReason={data.demo?.readOnlyReason}
          />
        {:else}
          <h2 class="mb-3 text-lg font-semibold tracking-tight">{sectionCopy.tabs.comments}</h2>
          <LazyModuleStatus failed={module.failed} heading={sectionCopy.tabs.comments} loadFailed={data.copy.comments.loadFailed} retry={data.copy.comments.retry} onRetry={module.retry} />
        {/if}
      {/key}
    </section>
  {/snippet}
</SectionDetailRoute>
