<script lang="ts">
import { onMount } from "svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import PageHeader from "$lib/components/PageHeader.svelte";
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
    common: { home: string; teachers: string };
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
  structuredDataJson: string;
  teacher: TeacherDetailData;
};

export let data: PageData;

let DescriptionCard:
  | typeof import("@/features/descriptions/components/DescriptionCard.svelte").default
  | null = null;
let CommentsPanel:
  | typeof import("@/features/comments/components/CommentsPanel.svelte").default
  | null = null;

onMount(() => {
  void (async () => {
    DescriptionCard ??= (
      await import("@/features/descriptions/components/DescriptionCard.svelte")
    ).default;
    CommentsPanel ??= (
      await import("@/features/comments/components/CommentsPanel.svelte")
    ).default;
  })();
});

$: copy = data.copy;
$: detailCopy = copy satisfies TeacherDetailCopy;
$: notAvailable = copy.teacherDetail.notAvailable;
$: displayName = catalogLocalizedDisplayName(data.teacher, data.locale);
</script>

<svelte:head>
  <title>{formatMessage(copy.metadata.pages.teacherDetail, { name: displayName })} - Life@USTC</title>
  {@html `<script type="application/ld+json">${data.structuredDataJson}</script>`}
</svelte:head>

<section class="grid min-h-full grid-rows-[auto_minmax(0,1fr)] bg-card lg:h-full lg:min-h-0">
  <div class="bg-card px-4 sm:px-5 lg:px-6">
    <PageHeader
      title={displayName}
      titleClass="text-2xl leading-tight sm:text-3xl"
    />
  </div>

  <div
    class="min-w-0 min-h-0 overflow-y-auto px-4 py-4 sm:px-5 lg:px-6"
    data-detail-scroll-container
  >
    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start lg:gap-10">
      <div class="grid min-w-0 gap-10">
        <section id="introduction" class="scroll-mt-4">
          {#key `description:teacher:${data.teacher.id}`}
            {#if DescriptionCard}
              <svelte:component
                this={DescriptionCard}
                targetType="teacher"
                targetId={data.teacher.id}
                initialData={data.descriptionData}
                locale={data.locale as "en-us" | "zh-cn"}
                copy={copy.descriptions}
                heading={copy.descriptions.title}
                showTitle={false}
              />
            {:else if data.descriptionData.description.renderedHtml}
              <h2 class="mb-3 text-lg font-semibold tracking-tight">
                {copy.descriptions.title}
              </h2>
              <div class="markdown-preview" data-slot="markdown-preview">
                {@html data.descriptionData.description.renderedHtml}
              </div>
            {/if}
          {/key}
        </section>

        <section id="sections" class="scroll-mt-4">
          <h2 class="mb-3 text-lg font-semibold tracking-tight">
            {copy.teacherDetail.teachingSectionsTitle}
          </h2>
          <p class="mb-4 text-sm text-muted-foreground">
            {copy.teacherDetail.teachingSectionsDescription}
          </p>
          <TeacherDetailSections
            copy={detailCopy}
            locale={data.locale}
            {notAvailable}
            teacher={data.teacher}
          />
        </section>

        <section id="comments" class="scroll-mt-4">
          {#key `comments:teacher:${data.teacher.id}`}
            {#if CommentsPanel}
              <svelte:component
                this={CommentsPanel}
                initialData={data.commentsData}
                permalinkBaseHref={commentTargetPermalinkBaseHref({
                  teacherId: data.teacher.id,
                  type: "teacher",
                })}
                targetType="teacher"
                targetId={data.teacher.id}
                heading={copy.comments.title}
              />
            {/if}
          {/key}
        </section>
      </div>

      <aside class="grid min-w-0 gap-6 lg:sticky lg:top-4">
        <section id="overview">
          <TeacherDetailBasicInfo
            copy={detailCopy}
            {notAvailable}
            {primaryName}
            teacher={data.teacher}
          />
        </section>
      </aside>
    </div>
  </div>
</section>
