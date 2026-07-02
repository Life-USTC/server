<script lang="ts">
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import DescriptionCard from "@/features/descriptions/components/DescriptionCard.svelte";
import DetailPinnedSummary from "$lib/components/DetailPinnedSummary.svelte";
import DetailSectionNav from "$lib/components/DetailSectionNav.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import type { CatalogNamed } from "../lib/catalog-list-display";
import {
  formatCatalogDetailMessage as formatMessage,
  courseDetailPrimaryName as primaryName,
  courseDetailSecondaryName as secondaryName,
  teacherNames,
} from "../lib/course-detail-display";
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
  type?: CatalogNamed | null;
};

type PageData = {
  commentsData: CatalogDetailCommentsData;
  copy: {
    common: { breadcrumb: string; courses: string; home: string };
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
  locale: string;
};

type PinnedSummaryItem = {
  label: string;
  mono?: boolean;
  variant?: "ghost" | "outline" | "secondary";
};

export let data: PageData;

let activeSectionHref = "";

$: copy = data.copy;
$: detailCopy = copy satisfies CourseDetailCopy;
$: notAvailable = copy.courseDetail.notAvailable;
$: displayName = primaryName(data.course) || data.course.code;
$: secondaryDisplayName = secondaryName(data.course);
$: commentsCount = data.commentsData
  ? Object.values(data.commentsData.commentMap).reduce(
      (sum, comments) => sum + comments.length,
      0,
    )
  : 0;
$: sectionNavItems = [
  { href: "#course-overview", label: copy.course.basicInfo },
  { href: "#course-description", label: copy.courseDetail.tabs.description },
  {
    href: "#course-sections",
    label: copy.courseDetail.teachingSections,
    meta: data.course.sections.length,
  },
  {
    href: "#course-comments",
    label: copy.courseDetail.tabs.comments,
    meta: commentsCount,
  },
];
$: activeSectionLabel =
  sectionNavItems.find((item) => item.href === activeSectionHref)?.label ??
  sectionNavItems[0]?.label ??
  "";
$: pinnedSummaryItems = [
  { label: data.course.code, mono: true, variant: "outline" as const },
  ...(data.course.educationLevel
    ? [{ label: primaryName(data.course.educationLevel) }]
    : []),
  ...(data.course.category
    ? [{ label: primaryName(data.course.category) }]
    : []),
  ...(data.course.classType
    ? [{ label: primaryName(data.course.classType) }]
    : []),
  ...(data.course.type ? [{ label: primaryName(data.course.type) }] : []),
] satisfies PinnedSummaryItem[];
</script>

<svelte:head>
  <title>{formatMessage(copy.metadata.pages.courseDetail, { name: displayName })} - Life@USTC</title>
  <meta name="description" content={`${displayName} (${data.course.code})`} />
  <meta property="og:title" content={displayName} />
</svelte:head>

<section class="grid gap-5">
  <PageHeader title={displayName} description={secondaryDisplayName}>
    {#snippet breadcrumb()}
      <Breadcrumb.Root label={copy.common.breadcrumb}>
        <Breadcrumb.List>
          <Breadcrumb.Item><Breadcrumb.Link href="/">{copy.common.home}</Breadcrumb.Link></Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item><Breadcrumb.Link href="/courses">{copy.common.courses}</Breadcrumb.Link></Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item><Breadcrumb.Page>{data.course.code}</Breadcrumb.Page></Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    {/snippet}
    {#snippet meta()}
      <Badge class="shrink-0 font-mono" variant="outline">{data.course.code}</Badge>
    {/snippet}
    {#snippet after()}
      <div class="flex flex-wrap gap-2">
        {#if data.course.educationLevel}
          <Badge variant="ghost">{primaryName(data.course.educationLevel)}</Badge>
        {/if}
        {#if data.course.category}
          <Badge variant="ghost">{primaryName(data.course.category)}</Badge>
        {/if}
        {#if data.course.classType}
          <Badge variant="ghost">{primaryName(data.course.classType)}</Badge>
        {/if}
        {#if data.course.type}
          <Badge variant="ghost">{primaryName(data.course.type)}</Badge>
        {/if}
      </div>
    {/snippet}
  </PageHeader>

  <DetailPinnedSummary
    activeSectionLabel={activeSectionLabel}
    eyebrow={copy.common.courses}
    items={pinnedSummaryItems}
    title={displayName}
    description={secondaryDisplayName}
  />

  <div class="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
    <DetailSectionNav
      bind:activeHref={activeSectionHref}
      ariaLabel={formatMessage(copy.metadata.pages.courseDetail, { name: displayName })}
      items={sectionNavItems}
      label={copy.common.courses}
    />

    <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <section class="scroll-mt-32" id="course-overview">
        <CourseDetailBasicInfo
          copy={detailCopy}
          course={data.course}
          {primaryName}
        />
      </section>

      <section class="scroll-mt-32" id="course-description">
        {#key `description:course:${data.course.id}`}
          <DescriptionCard
            targetType="course"
            targetId={data.course.id}
            initialData={data.descriptionData}
            locale={data.locale as "en-us" | "zh-cn"}
            copy={copy.descriptions}
          />
        {/key}
      </section>

      <section class="grid scroll-mt-32 gap-3" id="course-sections">
        <div>
          <h2 class="font-semibold text-lg">{copy.courseDetail.teachingSections}</h2>
          <p class="text-base-content/60 text-sm">{copy.courseDetail.teachingSectionsDescription}</p>
        </div>
        <CourseDetailSections
          copy={detailCopy}
          course={data.course}
          {notAvailable}
          {primaryName}
          {teacherNames}
        />
      </section>

      <section class="grid scroll-mt-32 gap-3" id="course-comments">
        <div>
          <h2 class="font-semibold text-lg">{copy.courseDetail.tabs.comments}</h2>
        </div>
        {#key `comments:course:${data.course.id}`}
          <CommentsPanel
            initialData={data.commentsData}
            permalinkBaseHref={commentTargetPermalinkBaseHref({
              courseJwId: data.course.jwId,
              type: "course",
            })}
            targetType="course"
            targetId={data.course.id}
          />
        {/key}
      </section>
    </div>
  </div>
</section>
