<script lang="ts">
import { onMount } from "svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import PageHeader from "$lib/components/PageHeader.svelte";
import type { CatalogNamed } from "../lib/catalog-list-display";
import {
  catalogLocalizedDisplayName,
  catalogPrimaryName as primaryName,
} from "../lib/catalog-list-display";
import { formatCatalogDetailMessage as formatMessage } from "../lib/course-detail-display";
import CourseDetailBasicInfo from "./CourseDetailBasicInfo.svelte";
import CourseDetailSections from "./CourseDetailSections.svelte";
import type {
  CourseDetailCopy,
  CourseDetailSection,
} from "./catalog-detail-component-types";
import type {
  CatalogDetailCommentsData,
  CatalogDetailDescriptionCopy,
  CatalogDetailDescriptionData,
} from "./catalog-detail-page-types";

type CourseDetailData = CatalogNamed & {
  category?: CatalogNamed | null;
  classType?: CatalogNamed | null;
  code: string;
  educationLevel?: CatalogNamed | null;
  id: number | string;
  jwId: number | string;
  sectionCount: number;
  sections: CourseDetailSection[];
  type?: CatalogNamed | null;
};

type PageData = {
  commentsData: CatalogDetailCommentsData;
  copy: {
    common: { courses: string; home: string };
    course: CourseDetailCopy["course"];
    courseDetail: CourseDetailCopy["courseDetail"] & {
      basicInfoDescription: string;
      campus: string;
      capacity: string;
      classType: string;
      courseType: string;
      noSections: string;
      notAvailable: string;
      sectionCode: string;
      semester: string;
      tabs: { comments: string; description: string; sections: string };
      teachers: string;
      teachingSections: string;
      teachingSectionsDescription: string;
    };
    descriptions: CatalogDetailDescriptionCopy;
    metadata: { pages: { courseDetail: string } };
  } & Record<string, unknown>;
  course: CourseDetailData;
  descriptionData: CatalogDetailDescriptionData;
  detailSection: "overview" | "introduction" | "sections" | "comments";
  locale: string;
  structuredDataJson: string;
};

export let data: PageData;

let DescriptionCard:
  | typeof import("@/features/descriptions/components/DescriptionCard.svelte").default
  | null = null;
let CommentsPanel:
  | typeof import("@/features/comments/components/CommentsPanel.svelte").default
  | null = null;

onMount(() => {
  void (async () => {
    DescriptionCard ??= (
      await import("@/features/descriptions/components/DescriptionCard.svelte")
    ).default;
    CommentsPanel ??= (
      await import("@/features/comments/components/CommentsPanel.svelte")
    ).default;
  })();
});

$: copy = data.copy;
$: detailCopy = copy satisfies CourseDetailCopy;
$: notAvailable = copy.courseDetail.notAvailable;
$: displayName =
  catalogLocalizedDisplayName(data.course, data.locale) || data.course.code;
</script>

<svelte:head>
  <title>{formatMessage(copy.metadata.pages.courseDetail, { name: displayName })} - Life@USTC</title>
  {@html `<script type="application/ld+json">${data.structuredDataJson}</script>`}
</svelte:head>

<section class="grid min-h-full grid-rows-[auto_minmax(0,1fr)] bg-card lg:h-full lg:min-h-0">
  <div class="bg-card px-4 sm:px-5 lg:px-6">
    <PageHeader
      title={displayName}
      titleClass="text-2xl leading-tight sm:text-3xl"
    />
  </div>

  <div
    class="min-w-0 min-h-0 overflow-y-auto px-4 py-4 sm:px-5 lg:px-6"
    data-detail-scroll-container
  >
    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start lg:gap-10">
      <div class="grid min-w-0 gap-10">
        <section id="introduction" class="scroll-mt-4">
          {#key `description:course:${data.course.id}`}
            {#if DescriptionCard}
              <svelte:component
                this={DescriptionCard}
                targetType="course"
                targetId={data.course.id}
                initialData={data.descriptionData}
                locale={data.locale as "en-us" | "zh-cn"}
                copy={copy.descriptions}
                heading={copy.courseDetail.tabs.description}
                showTitle={false}
              />
            {:else if data.descriptionData.description.renderedHtml}
              <h2 class="mb-3 text-lg font-semibold tracking-tight">
                {copy.courseDetail.tabs.description}
              </h2>
              <div class="markdown-preview" data-slot="markdown-preview">
                {@html data.descriptionData.description.renderedHtml}
              </div>
            {/if}
          {/key}
        </section>

        <section id="sections" class="scroll-mt-4">
          <h2 class="mb-3 text-lg font-semibold tracking-tight">
            {copy.courseDetail.teachingSections}
          </h2>
          <p class="mb-4 text-sm text-muted-foreground">
            {copy.courseDetail.teachingSectionsDescription}
          </p>
          <CourseDetailSections
            copy={detailCopy}
            course={data.course}
            locale={data.locale}
            {notAvailable}
            {primaryName}
          />
        </section>

        <section id="comments" class="scroll-mt-4">
          {#key `comments:course:${data.course.id}`}
            {#if CommentsPanel}
              <svelte:component
                this={CommentsPanel}
                initialData={data.commentsData}
                permalinkBaseHref={commentTargetPermalinkBaseHref({
                  courseJwId: data.course.jwId,
                  type: "course",
                })}
                targetType="course"
                targetId={data.course.id}
                heading={copy.courseDetail.tabs.comments}
              />
            {/if}
          {/key}
        </section>
      </div>

      <aside class="grid min-w-0 gap-6 lg:sticky lg:top-4">
        <section id="overview">
          <CourseDetailBasicInfo
            copy={detailCopy}
            course={data.course}
            {primaryName}
          />
        </section>
      </aside>
    </div>
  </div>
</section>
