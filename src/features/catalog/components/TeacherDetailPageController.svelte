<script lang="ts">
import { onMount } from "svelte";
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import DescriptionCard from "@/features/descriptions/components/DescriptionCard.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import {
  type CatalogDetailTab,
  mountCatalogDetailHashNavigation,
  normalizeCatalogDetailTab,
  replaceCatalogDetailTabUrl,
} from "../lib/catalog-detail-navigation";
import {
  type CatalogNamed,
  catalogPrimaryName as primaryName,
  catalogSecondaryName as secondaryName,
} from "../lib/catalog-list-display";
import { formatCatalogDetailMessage as formatMessage } from "../lib/course-detail-display";
import CatalogDetailTabs from "./CatalogDetailTabs.svelte";
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
      teachingSectionsTitle: string;
    };
  } & Record<string, unknown>;
  descriptionData: CatalogDetailDescriptionData;
  locale: string;
  tab: string | null | undefined;
  teacher: TeacherDetailData;
};

export let data: PageData;

let activeTab: CatalogDetailTab = normalizeCatalogDetailTab(data.tab);

$: copy = data.copy;
$: detailCopy = copy satisfies TeacherDetailCopy;
$: notAvailable = copy.teacherDetail.notAvailable;
$: displayName = primaryName(data.teacher);
$: secondaryDisplayName = secondaryName(data.teacher);
$: showSecondaryName = data.locale === "en-us" && Boolean(secondaryDisplayName);

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

  <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
    <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      {#key `description:teacher:${data.teacher.id}`}
        <DescriptionCard
          targetType="teacher"
          targetId={data.teacher.id}
          initialData={data.descriptionData}
          locale={data.locale as "en-us" | "zh-cn"}
          copy={copy.descriptions}
        />
      {/key}

      <CatalogDetailTabs
        {activeTab}
        commentsLabel={copy.comments.title}
        idPrefix="teacher-detail"
        sectionsLabel={copy.teacherDetail.teachingSectionsTitle}
        {setActiveTab}
      />

      {#if activeTab === "comments"}
        <div
          aria-labelledby="teacher-detail-comments-tab"
          id="teacher-detail-comments-panel"
          role="tabpanel"
          tabindex="0"
        >
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
        </div>
      {:else}
        <div
          aria-labelledby="teacher-detail-sections-tab"
          id="teacher-detail-sections-panel"
          role="tabpanel"
          tabindex="0"
        >
          <TeacherDetailSections
            copy={detailCopy}
            {notAvailable}
            {primaryName}
            {secondaryName}
            teacher={data.teacher}
          />
        </div>
      {/if}
    </div>

    <TeacherDetailBasicInfo
      copy={detailCopy}
      {displayName}
      {notAvailable}
      {primaryName}
      {secondaryDisplayName}
      teacher={data.teacher}
    />
  </div>
</section>
