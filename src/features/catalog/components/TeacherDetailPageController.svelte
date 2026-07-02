<script lang="ts">
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import DescriptionCard from "@/features/descriptions/components/DescriptionCard.svelte";
import DetailPinnedSummary from "$lib/components/DetailPinnedSummary.svelte";
import DetailSectionNav from "$lib/components/DetailSectionNav.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
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
  locale: string;
  teacher: TeacherDetailData;
};

type PinnedSummaryItem = {
  label: string;
  mono?: boolean;
  variant?: "ghost" | "outline" | "secondary";
};

export let data: PageData;

let activeSectionHref = "";

$: copy = data.copy;
$: detailCopy = copy satisfies TeacherDetailCopy;
$: notAvailable = copy.teacherDetail.notAvailable;
$: displayName = primaryName(data.teacher);
$: secondaryDisplayName = secondaryName(data.teacher);
$: showSecondaryName = data.locale === "en-us" && Boolean(secondaryDisplayName);
$: commentsCount = data.commentsData
  ? Object.values(data.commentsData.commentMap).reduce(
      (sum, comments) => sum + comments.length,
      0,
    )
  : 0;
$: sectionNavItems = [
  { href: "#teacher-overview", label: copy.teacherDetail.basicInfo },
  { href: "#teacher-description", label: copy.descriptions.title },
  {
    href: "#teacher-sections",
    label: copy.teacherDetail.teachingSectionsTitle,
    meta: data.teacher.sections.length,
  },
  {
    href: "#teacher-comments",
    label: copy.comments.title,
    meta: commentsCount,
  },
];
$: activeSectionLabel =
  sectionNavItems.find((item) => item.href === activeSectionHref)?.label ??
  sectionNavItems[0]?.label ??
  "";
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

<section class="grid gap-5">
  <PageHeader title={displayName} description={data.teacher.department ? primaryName(data.teacher.department) : ""}>
    {#snippet breadcrumb()}
      <Breadcrumb.Root label={copy.common.breadcrumb}>
        <Breadcrumb.List>
          <Breadcrumb.Item><Breadcrumb.Link href="/">{copy.common.home}</Breadcrumb.Link></Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item><Breadcrumb.Link href="/teachers">{copy.common.teachers}</Breadcrumb.Link></Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item><Breadcrumb.Page>{displayName}</Breadcrumb.Page></Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    {/snippet}
    {#snippet titleExtra()}
      {#if showSecondaryName}
        <span class="ml-2 text-base-content/60">({secondaryDisplayName})</span>
      {/if}
    {/snippet}
  </PageHeader>

  <DetailPinnedSummary
    activeSectionLabel={activeSectionLabel}
    eyebrow={copy.common.teachers}
    items={pinnedSummaryItems}
    title={displayName}
    description={data.teacher.department ? primaryName(data.teacher.department) : ""}
  />

  <div class="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
    <DetailSectionNav
      bind:activeHref={activeSectionHref}
      ariaLabel={formatMessage(copy.metadata.pages.teacherDetail, { name: displayName })}
      items={sectionNavItems}
      label={copy.common.teachers}
    />

    <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <section class="scroll-mt-32" id="teacher-overview">
        <TeacherDetailBasicInfo
          copy={detailCopy}
          {displayName}
          {notAvailable}
          {primaryName}
          {secondaryDisplayName}
          teacher={data.teacher}
        />
      </section>

      <section class="scroll-mt-32" id="teacher-description">
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

      <section class="grid scroll-mt-32 gap-3" id="teacher-sections">
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

      <section class="grid scroll-mt-32 gap-3" id="teacher-comments">
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
    </div>
  </div>
</section>
