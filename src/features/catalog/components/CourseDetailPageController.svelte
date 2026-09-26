<script lang="ts">
import LazyCommentsPanel from "@/features/comments/components/LazyCommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import LazyDescriptionCard from "@/features/descriptions/components/LazyDescriptionCard.svelte";
import type { PaginatedResponse } from "@/lib/pagination";
import DetailPageLayout from "$lib/components/DetailPageLayout.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import type { CatalogNamed } from "../lib/catalog-list-display";
import {
  catalogLocalizedDisplayName,
  catalogPrimaryName as primaryName,
} from "../lib/catalog-list-display";
import { formatCatalogDetailMessage as formatMessage } from "../lib/course-detail-display";
import CatalogSectionHistoryPagination from "./CatalogSectionHistoryPagination.svelte";
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
  sections: CourseDetailSection[];
  _count: { sections: number };
  type?: CatalogNamed | null;
};

type PageData = {
  commentsData: CatalogDetailCommentsData;
  copy: {
    comments: { loadFailed: string; retry: string };
    common: { next: string; previous: string; courses: string; home: string };
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
  sectionsPagination: PaginatedResponse<unknown>["pagination"];
  structuredDataJson: string;
};

export let data: PageData;

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

<DetailPageLayout>
  {#snippet header()}
    <PageHeader
      title={displayName}
      titleClass="text-2xl leading-tight sm:text-3xl"
    >
      {#snippet eyebrowContent()}
        <p class="font-mono text-sm text-muted-foreground" data-testid="course-public-code">{data.course.code}</p>
      {/snippet}
    </PageHeader>
  {/snippet}

        <section id="introduction" class="scroll-mt-4">
          {#key `description:course:${data.course.id}`}
            <LazyDescriptionCard
              resolveViewer
              targetType="course"
              targetId={data.course.id}
              initialData={data.descriptionData}
              locale={data.locale as "en-us" | "zh-cn"}
              copy={copy.descriptions}
              heading={copy.courseDetail.tabs.description}
            />
          {/key}
        </section>

        <section id="sections" class="scroll-mt-4">
          <h2 class="mb-3 text-lg font-semibold tracking-tight">
            {copy.courseDetail.teachingSections}
          </h2>
          <p class="mb-4 text-sm text-muted-foreground">
            {copy.courseDetail.teachingSectionsDescription}
          </p>
          <CatalogSectionHistoryPagination
            pagination={data.sectionsPagination}
            shown={data.course.sections.length}
            summaryTemplate={copy.courseDetail.sectionHistorySummary}
            ariaLabel={copy.courseDetail.sectionHistoryPagination}
            nextLabel={copy.common.next}
            previousLabel={copy.common.previous}
          />
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
            <LazyCommentsPanel
              initialData={data.commentsData}
              permalinkBaseHref={commentTargetPermalinkBaseHref({
                courseJwId: data.course.jwId,
                type: "course",
              })}
              targetType="course"
              targetId={data.course.id}
              heading={copy.courseDetail.tabs.comments}
              copy={copy.comments}
            />
          {/key}
        </section>
  {#snippet aside()}

        <section id="overview">
          <CourseDetailBasicInfo
            copy={detailCopy}
            course={data.course}
            {primaryName}
          />
        </section>
  {/snippet}
</DetailPageLayout>
