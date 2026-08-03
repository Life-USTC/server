<script lang="ts">
import BookOpenTextIcon from "@lucide/svelte/icons/book-open-text";
import InfoIcon from "@lucide/svelte/icons/info";
import ListIcon from "@lucide/svelte/icons/list";
import MessageSquareIcon from "@lucide/svelte/icons/message-square";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import DetailSectionNav from "$lib/components/DetailSectionNav.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import TruncatedCode from "$lib/components/TruncatedCode.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { courseDetailPagePath } from "../lib/catalog-detail-tab";
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

async function ensureDescriptionCard() {
  DescriptionCard ??= (
    await import("@/features/descriptions/components/DescriptionCard.svelte")
  ).default;
}

async function ensureCommentsPanel() {
  CommentsPanel ??= (
    await import("@/features/comments/components/CommentsPanel.svelte")
  ).default;
}

$: if (data.detailSection === "introduction") {
  void ensureDescriptionCard();
}
$: if (data.detailSection === "comments") {
  void ensureCommentsPanel();
}

$: copy = data.copy;
$: detailCopy = copy satisfies CourseDetailCopy;
$: notAvailable = copy.courseDetail.notAvailable;
$: displayName = primaryName(data.course) || data.course.code;
$: secondaryDisplayName = secondaryName(data.course);
$: courseJwId = data.course.jwId;
$: commentsCount = data.commentsData
  ? Object.values(data.commentsData.commentMap).reduce(
      (sum, comments) => sum + comments.length,
      0,
    )
  : 0;
$: sectionNavItems = [
  {
    href: courseDetailPagePath(courseJwId, "overview"),
    icon: InfoIcon,
    key: "overview" as const,
    label: copy.course.basicInfo,
  },
  {
    href: courseDetailPagePath(courseJwId, "introduction"),
    icon: BookOpenTextIcon,
    key: "introduction" as const,
    label: copy.courseDetail.tabs.description,
  },
  {
    href: courseDetailPagePath(courseJwId, "sections"),
    icon: ListIcon,
    key: "sections" as const,
    label: copy.courseDetail.teachingSections,
    meta: data.course.sectionCount,
  },
  {
    href: courseDetailPagePath(courseJwId, "comments"),
    icon: MessageSquareIcon,
    key: "comments" as const,
    label: copy.courseDetail.tabs.comments,
    meta: data.commentsData ? commentsCount : undefined,
  },
];
$: activeNavItem =
  sectionNavItems.find((item) => item.key === data.detailSection) ??
  sectionNavItems[0];
</script>

<svelte:head>
  <title>{formatMessage(copy.metadata.pages.courseDetail, { name: displayName })} - Life@USTC</title>
  {@html `<script type="application/ld+json">${data.structuredDataJson}</script>`}
</svelte:head>

<section class="grid min-h-full grid-rows-[auto_minmax(0,1fr)] bg-card lg:h-full lg:min-h-0">
  <div class="bg-card px-4 sm:px-5 lg:px-6">
    <PageHeader
      title={displayName}
      description={secondaryDisplayName}
      titleClass="text-2xl leading-tight sm:text-3xl"
    >
      {#snippet eyebrowContent()}
        <TruncatedCode class="text-muted-foreground" text={data.course.code} />
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
  </div>

  <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-card lg:grid-cols-[auto_minmax(0,1fr)] lg:grid-rows-none">
    <DetailSectionNav
      activeHref={activeNavItem?.href ?? courseDetailPagePath(courseJwId)}
      ariaLabel={formatMessage(copy.metadata.pages.courseDetail, { name: displayName })}
      items={sectionNavItems}
      label={copy.common.courses}
    />

    <div
      class="min-w-0 min-h-0 overflow-y-auto px-4 py-4 sm:px-5 lg:px-6"
      data-detail-scroll-container
    >
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
          {#if DescriptionCard}
            <svelte:component
              this={DescriptionCard}
              targetType="course"
              targetId={data.course.id}
              initialData={data.descriptionData}
              locale={data.locale as "en-us" | "zh-cn"}
              copy={copy.descriptions}
              showTitle={false}
            />
          {:else if data.descriptionData.description.renderedHtml}
            <div class="markdown-preview" data-slot="markdown-preview">
              {@html data.descriptionData.description.renderedHtml}
            </div>
          {/if}
        {/key}
      </section>
      {:else if data.detailSection === "sections"}
      <section id="course-sections">
        <CourseDetailSections
          copy={detailCopy}
          course={data.course}
          {notAvailable}
          {primaryName}
          {teacherNames}
        />
      </section>
      {:else if data.detailSection === "comments"}
      <section id="course-comments">
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
            />
          {/if}
        {/key}
      </section>
      {/if}
    </div>
  </div>
</section>
