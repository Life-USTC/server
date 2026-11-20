<script lang="ts">
import type { Snippet } from "svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
export let content: Snippet<[typeof pageContent]>;

import {
  catalogPrimaryName,
  catalogSecondaryName,
} from "@/features/catalog/lib/catalog-list-display";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import type { DemoView } from "@/features/demo/lib/demo-types";
import type { EndlessScrollLabels } from "@/lib/navigation/endless-list.svelte";
import type { PaginatedResponse } from "@/lib/pagination";
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
  catalogPrimaryName as primaryName,
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
import TeacherDetailIdentity from "./TeacherDetailIdentity.svelte";

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

$: copy = data.copy;
$: detailCopy = copy satisfies TeacherDetailCopy;
$: notAvailable = copy.teacherDetail.notAvailable;
$: displayName = catalogLocalizedDisplayName(data.teacher, data.locale);
$: pageContent = { data, copy, detailCopy, notAvailable };
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

  {@render content(pageContent)}
</CollectionPage>
