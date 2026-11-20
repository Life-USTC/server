<script lang="ts">
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import SectionBasicInfoCard from "@/features/section-detail/components/SectionBasicInfoCard.svelte";
import SectionBasicInfoDetails from "@/features/section-detail/components/SectionBasicInfoDetails.svelte";
import SectionDetailIdentity from "@/features/section-detail/components/SectionDetailIdentity.svelte";
import { detailPageModule } from "@/features/section-detail/lib/detail-page-module.svelte";
import SectionDetailRoute from "../SectionDetailRoute.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
const module = detailPageModule(
  () => import("@/features/descriptions/components/DescriptionCard.svelte"),
);
const DescriptionCard = $derived(module.component);
const commentsModule = detailPageModule(
  () => import("@/features/comments/components/CommentsPanel.svelte"),
);
const CommentsPanel = $derived(commentsModule.component);
</script>

<SectionDetailRoute {data} {form}>
  {#snippet content({ data, descriptionData, commonCopy, notAvailable, primaryName, displaySection, sectionCopy, yesNo, sectionTeachersLabel, teacherName, periodDetailRows, commentTargets })}
    <section id="introduction" data-detail-tab="introduction" class="grid gap-4 scroll-mt-4">
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
      <div id="overview" class="grid gap-4">
        <SectionBasicInfoDetails {commonCopy} {notAvailable} {primaryName} section={displaySection} {sectionCopy} {periodDetailRows} {yesNo} />
        <div data-detail-identity>
          <SectionDetailIdentity {notAvailable} {primaryName} section={displaySection} {sectionCopy} {teacherName} teachers={displaySection.teachers} />
        </div>
        <SectionBasicInfoCard {notAvailable} {primaryName} section={displaySection} {sectionCopy} {sectionTeachersLabel} />
      </div>
    <section id="comments" class="scroll-mt-4 min-w-0">
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
          <LazyModuleStatus failed={commentsModule.failed} heading={sectionCopy.tabs.comments} loadFailed={data.copy.comments.loadFailed} retry={data.copy.comments.retry} onRetry={commentsModule.retry} />
        {/if}
      {/key}
    </section>
    </section>
  {/snippet}
</SectionDetailRoute>
