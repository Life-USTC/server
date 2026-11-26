<script lang="ts">
import OfficialAcademicProfile from "@/features/catalog/components/OfficialAcademicProfile.svelte";
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import LazyModuleStatus from "#lib/components/LazyModuleStatus.svelte";
import SectionBasicInfoAdminClasses from "@/features/section-detail/components/SectionBasicInfoAdminClasses.svelte";
import SectionBasicInfoDetails from "@/features/section-detail/components/SectionBasicInfoDetails.svelte";
import SectionBasicInfoRelatedSections from "@/features/section-detail/components/SectionBasicInfoRelatedSections.svelte";
import SectionTeachersCard from "@/features/section-detail/components/SectionTeachersCard.svelte";
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
  {#snippet content({ data, descriptionData, commonCopy, notAvailable, primaryName, displaySection, sectionCopy, yesNo, teacherName, periodDetailRows, commentTargets })}
    <section id="introduction" data-detail-tab="introduction" class="grid gap-4 scroll-mt-4">
      {#if data.officialProfile}
        <OfficialAcademicProfile profile={data.officialProfile} locale={data.locale} kind="section" />
      {/if}
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
            showTitle={Boolean(data.officialProfile)}
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
        <a href={`/catalog/courses/${displaySection.course.jwId}`} class="flex min-h-11 w-fit items-center gap-2 text-sm font-medium underline-offset-4 hover:underline">
          <BookOpenIcon aria-hidden="true" class="size-4 shrink-0" />{primaryName(displaySection.course)}
        </a>
        <SectionBasicInfoDetails {commonCopy} {notAvailable} {primaryName} section={displaySection} {sectionCopy} {periodDetailRows} {yesNo} />
        <div data-detail-identity>
          <SectionTeachersCard {primaryName} {sectionCopy} {teacherName} teachers={displaySection.teachers} />
        </div>
        <SectionBasicInfoAdminClasses {primaryName} section={displaySection} {sectionCopy} />
        <SectionBasicInfoRelatedSections section={displaySection} {sectionCopy} />
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
          <h2 class="mb-3 section-heading">{sectionCopy.tabs.comments}</h2>
          <LazyModuleStatus failed={commentsModule.failed} heading={sectionCopy.tabs.comments} loadFailed={data.copy.comments.loadFailed} retry={data.copy.comments.retry} onRetry={commentsModule.retry} />
        {/if}
      {/key}
    </section>
    </section>
  {/snippet}
</SectionDetailRoute>
