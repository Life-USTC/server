<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import {
  catalogPrimaryName,
  catalogSecondaryName,
} from "@/features/catalog/lib/catalog-list-display";
import LazyCommentsPanel from "@/features/comments/components/LazyCommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import type { DemoView } from "@/features/demo/lib/demo-types";
import LazyDescriptionCard from "@/features/descriptions/components/LazyDescriptionCard.svelte";
import type {
  EndlessScrollLabels,
  EndlessScrollState,
} from "@/lib/navigation/endless-list.svelte";
import type { PaginatedResponse } from "@/lib/pagination";
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
  catalogPrimaryName as primaryName,
} from "../lib/catalog-list-display";
import { formatCatalogDetailMessage as formatMessage } from "../lib/course-detail-display";
import CatalogSectionHistory from "./CatalogSectionHistory.svelte";
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
import TeacherDetailIdentity from "./TeacherDetailIdentity.svelte";
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
  demo?: DemoView | null;
  commentsData: CatalogDetailCommentsData;
  copy: {
    comments: { loadFailed: string; retry: string; title: string };
    common: {
      endlessScroll: EndlessScrollLabels;
      home: string;
      teachers: string;
    };
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
export let endless: EndlessScrollState;

$: copy = data.copy;
$: detailCopy = copy satisfies TeacherDetailCopy;
$: notAvailable = copy.teacherDetail.notAvailable;
$: displayName = catalogLocalizedDisplayName(data.teacher, data.locale);
</script>

<svelte:head>
  <title>{formatMessage(copy.metadata.pages.teacherDetail, { name: displayName })} - Life@USTC</title>
  {#if !data.demo}{@html `<script type="application/ld+json">${data.structuredDataJson}</script>`}{/if}
</svelte:head>

<CollectionPage
  layout="detail"
  density="detail"
  title={catalogPrimaryName(data.teacher) || displayName}
>
  {#snippet lead()}
    {#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} />{/if}
  {/snippet}
  {#snippet titleExtra()}
    {#if data.locale === "en-us" && catalogSecondaryName(data.teacher) && catalogSecondaryName(data.teacher) !== catalogPrimaryName(data.teacher)}{" "}<span class="text-[0.85em] font-normal text-muted-foreground" data-slot="entity-secondary-name">({catalogSecondaryName(data.teacher)})</span>{/if}
  {/snippet}
  {#snippet identity()}
    <TeacherDetailIdentity copy={detailCopy} teacher={data.teacher} {primaryName} {notAvailable} />
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
              readOnlyReason={data.demo?.readOnlyReason}
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
          <CatalogSectionHistory state={endless} labels={copy.common.endlessScroll}>
            <TeacherDetailSections
              copy={detailCopy}
              locale={data.locale}
              {notAvailable}
              teacher={data.teacher}
            />
          </CatalogSectionHistory>
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
              readOnlyReason={data.demo?.readOnlyReason}
            />
          {/key}
        </section>
  {#snippet aside()}

        <section id="overview">
          <TeacherDetailBasicInfo
            copy={detailCopy}
            teacher={data.teacher}
          />
        </section>
  {/snippet}
</CollectionPage>
