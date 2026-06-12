<script lang="ts">
import { onMount } from "svelte";
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import DescriptionCard from "@/features/descriptions/components/DescriptionCard.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import {
  type CatalogDetailTab,
  mountCatalogDetailHashNavigation,
  normalizeCatalogDetailTab,
  replaceCatalogDetailTabUrl,
} from "../lib/catalog-detail-navigation";
import type { CatalogNamed } from "../lib/catalog-list-display";
import {
  formatCatalogDetailMessage as formatMessage,
  courseDetailPrimaryName as primaryName,
  courseDetailSecondaryName as secondaryName,
  teacherNames,
} from "../lib/course-detail-display";
import CatalogDetailTabs from "./CatalogDetailTabs.svelte";
import CourseDetailBasicInfo from "./CourseDetailBasicInfo.svelte";
import CourseDetailSections from "./CourseDetailSections.svelte";
import type {
  CatalogDetailCopy,
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
  sections: CourseDetailSection[];
  type?: CatalogNamed | null;
};

type PageData = {
  commentsData: CatalogDetailCommentsData;
  copy: {
    common: { courses: string; home: string };
    course: CatalogDetailCopy["course"];
    courseDetail: {
      basicInfoDescription: string;
      campus: string;
      capacity: string;
      classType: string;
      courseType: string;
      noSections: string;
      notAvailable: string;
      sectionCode: string;
      semester: string;
      tabs: { comments: string; sections: string };
      teachers: string;
    };
    descriptions: CatalogDetailDescriptionCopy;
    metadata: { pages: { courseDetail: string } };
  } & Record<string, unknown>;
  course: CourseDetailData;
  descriptionData: CatalogDetailDescriptionData;
  locale: string;
  tab: string | null | undefined;
};

export let data: PageData;

let activeTab: CatalogDetailTab = normalizeCatalogDetailTab(data.tab);

$: copy = data.copy;
$: detailCopy = copy as unknown as CatalogDetailCopy;
$: notAvailable = copy.courseDetail.notAvailable;
$: displayName = primaryName(data.course) || data.course.code;
$: secondaryDisplayName = secondaryName(data.course);

function setActiveTab(nextTab: CatalogDetailTab) {
  activeTab = nextTab;
  replaceCatalogDetailTabUrl(nextTab);
}

onMount(() => {
  return mountCatalogDetailHashNavigation({
    setActiveTab: (tab) => {
      activeTab = tab;
    },
  });
});
</script>

<svelte:head>
  <title>{formatMessage(copy.metadata.pages.courseDetail, { name: displayName })} - Life@USTC</title>
  <meta name="description" content={`${displayName} (${data.course.code})`} />
  <meta property="og:title" content={displayName} />
</svelte:head>

<section class="grid gap-5">
  <PageHeader title={displayName} description={secondaryDisplayName}>
    {#snippet breadcrumb()}
      <Breadcrumb.Root>
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

  <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
    <div class="grid min-w-0 gap-5">
      <DescriptionCard
        targetType="course"
        targetId={data.course.id}
        initialData={data.descriptionData}
        locale={data.locale as "en-us" | "zh-cn"}
        copy={copy.descriptions}
      />

      <CatalogDetailTabs
        {activeTab}
        commentsLabel={copy.courseDetail.tabs.comments}
        sectionsLabel={copy.courseDetail.tabs.sections}
        {setActiveTab}
      />

      {#if activeTab === "comments"}
        <CommentsPanel
          initialData={data.commentsData}
          targetType="course"
          targetId={data.course.id}
        />
      {:else}
        <CourseDetailSections
          copy={detailCopy}
          course={data.course}
          {notAvailable}
          {primaryName}
          {teacherNames}
        />
      {/if}
    </div>

    <CourseDetailBasicInfo
      copy={detailCopy}
      course={data.course}
      {primaryName}
    />
  </div>
</section>
