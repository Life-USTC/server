<script lang="ts">
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import DescriptionCard from "@/features/descriptions/components/DescriptionCard.svelte";
import DetailPinnedSummary from "$lib/components/DetailPinnedSummary.svelte";
import DetailSectionNav from "$lib/components/DetailSectionNav.svelte";
import {
  type CatalogNamed,
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
} from "../lib/catalog-list-display";
import { formatCatalogDetailMessage as formatMessage } from "../lib/course-detail-display";
import type {
  TeacherDetailCopy,
  TeacherDetailSection,
} from "./catalog-detail-component-types";
import type {
  CatalogDetailCommentsData,
  CatalogDetailDescriptionCopy,
  CatalogDetailDescriptionData,
} from "./catalog-detail-page-types";
import TeacherDetailBasicInfo from "./TeacherDetailBasicInfo.svelte";
import TeacherDetailSections from "./TeacherDetailSections.svelte";

type TeacherDetailData = CatalogNamed & {
  address?: string | null;
  department?: CatalogNamed | null;
  email?: string | null;
  id: number | string;
  mobile?: string | null;
  sections: TeacherDetailSection[];
  teacherTitle?: CatalogNamed | null;
  telephone?: string | null;
};

type PageData = {
  commentsData: CatalogDetailCommentsData;
  copy: {
    comments: { title: string };
    common: { breadcrumb: string; home: string; teachers: string };
    descriptions: CatalogDetailDescriptionCopy;
    metadata: { pages: { teacherDetail: string } };
    teacherDetail: TeacherDetailCopy["teacherDetail"] & {
      notAvailable: string;
      teachingSectionsDescription: string;
      teachingSectionsTitle: string;
    };
  } & Record<string, unknown>;
  descriptionData: CatalogDetailDescriptionData;
  detailSection: "overview" | "introduction" | "sections" | "comments";
  locale: string;
  teacher: TeacherDetailData;
};

type PinnedSummaryItem = {
  label: string;
  mono?: boolean;
  variant?: "ghost" | "outline" | "secondary";
};

export let data: PageData;

$: copy = data.copy;
$: detailCopy = copy satisfies TeacherDetailCopy;
$: notAvailable = copy.teacherDetail.notAvailable;
$: displayName = primaryName(data.teacher);
$: secondaryDisplayName = secondaryName(data.teacher);
$: teacherDescription = data.teacher.department
  ? primaryName(data.teacher.department)
  : secondaryDisplayName;
$: teacherBaseHref = `/teachers/${data.teacher.id}`;
$: commentsCount = data.commentsData
  ? Object.values(data.commentsData.commentMap).reduce(
      (sum, comments) => sum + comments.length,
      0,
    )
  : 0;
$: sectionNavItems = [
  {
    href: teacherBaseHref,
    key: "overview" as const,
    label: copy.teacherDetail.basicInfo,
  },
  {
    href: `${teacherBaseHref}/introduction`,
    key: "introduction" as const,
    label: copy.descriptions.title,
  },
  {
    href: `${teacherBaseHref}/sections`,
    key: "sections" as const,
    label: copy.teacherDetail.teachingSectionsTitle,
    meta: data.teacher.sections.length,
  },
  {
    href: `${teacherBaseHref}/comments`,
    key: "comments" as const,
    label: copy.comments.title,
    meta: commentsCount,
  },
];
$: activeNavItem =
  sectionNavItems.find((item) => item.key === data.detailSection) ??
  sectionNavItems[0];
$: activeSectionLabel = activeNavItem?.label ?? "";
$: pinnedSummaryItems = [
  ...(data.teacher.department
    ? [
        {
          label: primaryName(data.teacher.department),
          variant: "outline" as const,
        },
      ]
    : []),
  ...(data.teacher.teacherTitle
    ? [{ label: primaryName(data.teacher.teacherTitle) }]
    : []),
  ...(data.teacher.email
    ? [{ label: data.teacher.email, variant: "secondary" as const }]
    : []),
] satisfies PinnedSummaryItem[];
</script>

<svelte:head>
  <title>{formatMessage(copy.metadata.pages.teacherDetail, { name: displayName })} - Life@USTC</title>
  <meta name="description" content={displayName} />
  <meta property="og:title" content={displayName} />
</svelte:head>

<section class="grid">
  <DetailPinnedSummary
    activeSectionLabel={activeSectionLabel}
    eyebrow={copy.common.teachers}
    items={pinnedSummaryItems}
    parentHref="/teachers"
    parentLabel={copy.common.teachers}
    title={displayName}
    description={teacherDescription}
  />

  <div class="-mx-4 grid sm:-mx-5 lg:-mx-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
    <DetailSectionNav
      activeHref={activeNavItem?.href ?? teacherBaseHref}
      ariaLabel={formatMessage(copy.metadata.pages.teacherDetail, { name: displayName })}
      items={sectionNavItems}
      label={copy.common.teachers}
    />

    <div class="min-w-0 px-4 py-5 sm:px-5 lg:px-6">
      {#if data.detailSection === "overview"}
      <section id="teacher-overview">
        <TeacherDetailBasicInfo
          copy={detailCopy}
          {displayName}
          {notAvailable}
          {primaryName}
          {secondaryDisplayName}
          teacher={data.teacher}
        />
      </section>
      {:else if data.detailSection === "introduction"}
      <section id="teacher-description">
        {#key `description:teacher:${data.teacher.id}`}
          <DescriptionCard
            targetType="teacher"
            targetId={data.teacher.id}
            initialData={data.descriptionData}
            locale={data.locale as "en-us" | "zh-cn"}
            copy={copy.descriptions}
          />
        {/key}
      </section>
      {:else if data.detailSection === "sections"}
      <section class="grid gap-3" id="teacher-sections">
        <div>
          <h2 class="font-semibold text-lg">{copy.teacherDetail.teachingSectionsTitle}</h2>
          <p class="text-base-content/60 text-sm">{copy.teacherDetail.teachingSectionsDescription}</p>
        </div>
        <TeacherDetailSections
          copy={detailCopy}
          {notAvailable}
          {primaryName}
          {secondaryName}
          teacher={data.teacher}
        />
      </section>
      {:else if data.detailSection === "comments"}
      <section class="grid gap-3" id="teacher-comments">
        <div>
          <h2 class="font-semibold text-lg">{copy.comments.title}</h2>
        </div>
        {#key `comments:teacher:${data.teacher.id}`}
          <CommentsPanel
            initialData={data.commentsData}
            permalinkBaseHref={commentTargetPermalinkBaseHref({
              teacherId: data.teacher.id,
              type: "teacher",
            })}
            targetType="teacher"
            targetId={data.teacher.id}
          />
        {/key}
      </section>
      {/if}
    </div>
  </div>
</section>
