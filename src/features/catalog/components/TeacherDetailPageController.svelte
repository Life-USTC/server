<script lang="ts">
import { onMount } from "svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
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
    comments: { loadFailed: string; retry: string; title: string };
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
let descriptionLoadError = false;
let commentsLoadError = false;
let detailModulesLoading = true;

async function loadDetailModules() {
  detailModulesLoading = true;
  descriptionLoadError = false;
  commentsLoadError = false;

  const [descriptionModule, commentsModule] = await Promise.allSettled([
    import("@/features/descriptions/components/DescriptionCard.svelte"),
    import("@/features/comments/components/CommentsPanel.svelte"),
  ]);

  if (descriptionModule.status === "fulfilled") {
    DescriptionCard = descriptionModule.value.default;
  } else {
    descriptionLoadError = true;
  }

  if (commentsModule.status === "fulfilled") {
    CommentsPanel = commentsModule.value.default;
  } else {
    commentsLoadError = true;
  }

  detailModulesLoading = false;
}

onMount(() => {
  void loadDetailModules();
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
  <div class="bg-card">
    <div class="page-frame page-frame-content px-4 sm:px-5 lg:px-6">
    <PageHeader
      title={displayName}
      titleClass="text-2xl leading-tight sm:text-3xl"
    />
    </div>
  </div>

  <div class="min-w-0 min-h-0 overflow-y-auto" data-detail-scroll-container>
    <div class="page-frame page-frame-content grid min-h-full gap-8 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start lg:gap-10 sm:px-5 lg:px-6">
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
            {:else if descriptionLoadError}
              <Alert.Root variant="destructive">
                <Alert.Description>{copy.descriptions.loadFailed}</Alert.Description>
                <Alert.Action>
                  <Button size="sm" variant="ghost" onclick={() => void loadDetailModules()}>
                    {copy.descriptions.retry}
                  </Button>
                </Alert.Action>
              </Alert.Root>
            {:else if detailModulesLoading}
              <div class="grid gap-3" aria-busy="true" aria-label={copy.descriptions.title}>
                <Skeleton class="h-5 w-28" />
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-11/12" />
                <Skeleton class="h-4 w-4/5" />
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
            {:else if commentsLoadError}
              <Alert.Root variant="destructive">
                <Alert.Description>{copy.comments.loadFailed}</Alert.Description>
                <Alert.Action>
                  <Button size="sm" variant="ghost" onclick={() => void loadDetailModules()}>
                    {copy.comments.retry}
                  </Button>
                </Alert.Action>
              </Alert.Root>
            {:else if detailModulesLoading}
              <div class="grid gap-3" aria-busy="true" aria-label={copy.comments.title}>
                <Skeleton class="h-5 w-24" />
                <Skeleton class="h-16 w-full" />
              </div>
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
