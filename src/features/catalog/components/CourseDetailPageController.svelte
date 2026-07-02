<script lang="ts">
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import DescriptionCard from "@/features/descriptions/components/DescriptionCard.svelte";
import DetailPinnedSummary from "$lib/components/DetailPinnedSummary.svelte";
import DetailSectionNav from "$lib/components/DetailSectionNav.svelte";
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
};

type PinnedSummaryItem = {
  label: string;
  mono?: boolean;
  variant?: "ghost" | "outline" | "secondary";
};

export let data: PageData;

$: copy = data.copy;
$: detailCopy = copy satisfies CourseDetailCopy;
$: notAvailable = copy.courseDetail.notAvailable;
$: displayName = primaryName(data.course) || data.course.code;
$: secondaryDisplayName = secondaryName(data.course);
$: courseBaseHref = `/courses/${data.course.jwId}`;
$: commentsCount = data.commentsData
  ? Object.values(data.commentsData.commentMap).reduce(
      (sum, comments) => sum + comments.length,
      0,
    )
  : 0;
$: sectionNavItems = [
  {
    href: courseBaseHref,
    key: "overview" as const,
    label: copy.course.basicInfo,
  },
  {
    href: `${courseBaseHref}/introduction`,
    key: "introduction" as const,
    label: copy.courseDetail.tabs.description,
  },
  {
    href: `${courseBaseHref}/sections`,
    key: "sections" as const,
    label: copy.courseDetail.teachingSections,
    meta: data.course.sections.length,
  },
  {
    href: `${courseBaseHref}/comments`,
    key: "comments" as const,
    label: copy.courseDetail.tabs.comments,
    meta: commentsCount,
  },
];
$: activeNavItem =
  sectionNavItems.find((item) => item.key === data.detailSection) ??
  sectionNavItems[0];
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

<section class="grid">
  <DetailPinnedSummary
    eyebrow={copy.common.courses}
    items={pinnedSummaryItems}
    title={displayName}
    description={secondaryDisplayName}
  />

  <div class="-mx-4 grid min-h-[calc(100vh-8rem)] bg-base-100 sm:-mx-5 lg:-mx-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
    <DetailSectionNav
      activeHref={activeNavItem?.href ?? courseBaseHref}
      ariaLabel={formatMessage(copy.metadata.pages.courseDetail, { name: displayName })}
      items={sectionNavItems}
      label={copy.common.courses}
    />

    <div class="min-w-0 px-4 py-5 sm:px-5 lg:px-6">
      {#if data.detailSection === "overview"}
      <section id="course-overview">
        <CourseDetailBasicInfo
          copy={detailCopy}
          course={data.course}
          {primaryName}
        />
      </section>
      {:else if data.detailSection === "introduction"}
      <section id="course-description">
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
      {:else if data.detailSection === "sections"}
      <section class="grid gap-3" id="course-sections">
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
      {:else if data.detailSection === "comments"}
      <section class="grid gap-3" id="course-comments">
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
      {/if}
    </div>
  </div>
</section>
