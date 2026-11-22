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
import type { CatalogNamed } from "../lib/catalog-list-display";
import {
  catalogLocalizedDisplayName,
  catalogPrimaryName as primaryName,
} from "../lib/catalog-list-display";
import { formatCatalogDetailMessage as formatMessage } from "../lib/course-detail-display";
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
  demo?: DemoView | null;
  commentsData: CatalogDetailCommentsData;
  copy: {
    comments: { loadFailed: string; retry: string };
    common: {
      endlessScroll: EndlessScrollLabels;
      courses: string;
      home: string;
    };
    course: CourseDetailCopy["course"];
    courseDetail: CourseDetailCopy["courseDetail"] & {
      basicInfoDescription: string;
      campus: string;
      capacity: string;
      classType: string;
      courseType: string;
      emptySectionsDescription: string;
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
$: pageContent = { data, copy, detailCopy, notAvailable, primaryName };
</script>

<svelte:head>
  <title>{formatMessage(copy.metadata.pages.courseDetail, { name: displayName })} - Life@USTC</title>
  {#if !data.demo}{@html `<script type="application/ld+json">${data.structuredDataJson}</script>`}{/if}
</svelte:head>

<CollectionPage
  layout="detail"
  density="detail"
  title={catalogPrimaryName(data.course) || displayName}
>
  {#snippet lead()}
    {#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} />{/if}
  {/snippet}
  {#snippet titleExtra()}
    {#if data.locale === "en-us" && catalogSecondaryName(data.course) && catalogSecondaryName(data.course) !== catalogPrimaryName(data.course)}{" "}<span class="text-[0.85em] font-normal text-muted-foreground" data-slot="entity-secondary-name">({catalogSecondaryName(data.course)})</span>{/if}
  {/snippet}
  {#snippet belowTitle()}
    <p class="font-mono text-sm text-muted-foreground" data-testid="course-public-code">{data.course.code}</p>
  {/snippet}

  {@render content(pageContent)}
</CollectionPage>
