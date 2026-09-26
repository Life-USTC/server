<script lang="ts">
import LazyCommentsPanel from "@/features/comments/components/LazyCommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import LazyDescriptionCard from "@/features/descriptions/components/LazyDescriptionCard.svelte";
import type { PaginatedResponse } from "@/lib/pagination";
import DetailPageLayout from "$lib/components/DetailPageLayout.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
  catalogPrimaryName as primaryName,
} from "../lib/catalog-list-display";
import { formatCatalogDetailMessage as formatMessage } from "../lib/course-detail-display";
import CatalogSectionHistoryPagination from "./CatalogSectionHistoryPagination.svelte";
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
  _count: { sections: number };
  teacherTitle?: CatalogNamed | null;
  telephone?: string | null;
};

type PageData = {
  commentsData: CatalogDetailCommentsData;
  copy: {
    comments: { loadFailed: string; retry: string; title: string };
    common: { next: string; previous: string; home: string; teachers: string };
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
  sectionsPagination: PaginatedResponse<unknown>["pagination"];
  structuredDataJson: string;
  teacher: TeacherDetailData;
};

export let data: PageData;

$: copy = data.copy;
$: detailCopy = copy satisfies TeacherDetailCopy;
$: notAvailable = copy.teacherDetail.notAvailable;
$: displayName = catalogLocalizedDisplayName(data.teacher, data.locale);
</script>

<svelte:head>
  <title>{formatMessage(copy.metadata.pages.teacherDetail, { name: displayName })} - Life@USTC</title>
  {@html `<script type="application/ld+json">${data.structuredDataJson}</script>`}
</svelte:head>

<DetailPageLayout>
  {#snippet header()}
    <PageHeader
      title={displayName}
      titleClass="text-2xl leading-tight sm:text-3xl"
    />
  {/snippet}

        <section id="introduction" class="scroll-mt-4">
          {#key `description:teacher:${data.teacher.id}`}
            <LazyDescriptionCard
              resolveViewer
              targetType="teacher"
              targetId={data.teacher.id}
              initialData={data.descriptionData}
              locale={data.locale as "en-us" | "zh-cn"}
              copy={copy.descriptions}
              heading={copy.descriptions.title}
            />
          {/key}
        </section>

        <section id="sections" class="scroll-mt-4">
          <h2 class="mb-3 text-lg font-semibold tracking-tight">
            {copy.teacherDetail.teachingSectionsTitle}
          </h2>
          <p class="mb-4 text-sm text-muted-foreground">
            {copy.teacherDetail.teachingSectionsDescription}
          </p>
          <CatalogSectionHistoryPagination
            pagination={data.sectionsPagination}
            shown={data.teacher.sections.length}
            summaryTemplate={copy.teacherDetail.sectionHistorySummary}
            ariaLabel={copy.teacherDetail.sectionHistoryPagination}
            nextLabel={copy.common.next}
            previousLabel={copy.common.previous}
          />
          <TeacherDetailSections
            copy={detailCopy}
            locale={data.locale}
            {notAvailable}
            teacher={data.teacher}
          />
        </section>

        <section id="comments" class="scroll-mt-4">
          {#key `comments:teacher:${data.teacher.id}`}
            <LazyCommentsPanel
              initialData={data.commentsData}
              permalinkBaseHref={commentTargetPermalinkBaseHref({
                teacherId: data.teacher.id,
                type: "teacher",
              })}
              targetType="teacher"
              targetId={data.teacher.id}
              heading={copy.comments.title}
              copy={copy.comments}
            />
          {/key}
        </section>
  {#snippet aside()}

        <section id="overview">
          <TeacherDetailBasicInfo
            copy={detailCopy}
            {notAvailable}
            {primaryName}
            teacher={data.teacher}
          />
        </section>
  {/snippet}
</DetailPageLayout>
