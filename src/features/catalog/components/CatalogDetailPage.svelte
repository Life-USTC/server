<script lang="ts">
import type { Snippet } from "svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import type { DemoView } from "@/features/demo/lib/demo-types";
import {
  catalogLocalizedDisplayName,
  catalogPrimaryName,
  catalogSecondaryName,
} from "../lib/catalog-list-display";
import { formatCatalogDetailMessage as formatMessage } from "../lib/course-detail-display";
import type {
  loadCourseDetailPage,
  loadTeacherDetailPage,
} from "../server/catalog-detail-page-server";

type DetailData = Awaited<
  ReturnType<typeof loadCourseDetailPage | typeof loadTeacherDetailPage>
>;
let {
  data,
  children,
}: { data: DetailData & { demo?: DemoView | null }; children: Snippet } =
  $props();
const entity = $derived("course" in data ? data.course : data.teacher);
const course = $derived("course" in data ? data.course : undefined);
const titleTemplate = $derived(
  "course" in data
    ? data.copy.metadata.pages.courseDetail
    : data.copy.metadata.pages.teacherDetail,
);
const displayName = $derived(
  catalogLocalizedDisplayName(entity, data.locale) || course?.code || "",
);
const primary = $derived(catalogPrimaryName(entity));
const secondary = $derived(catalogSecondaryName(entity));
</script>

{#snippet courseCode()}
  <p class="font-mono text-sm text-muted-foreground" data-testid="course-public-code">{course?.code}</p>
{/snippet}

<svelte:head>
  <title>{formatMessage(titleTemplate, { name: displayName })} - Life@USTC</title>
  {#if !data.demo}{@html `<script type="application/ld+json">${data.structuredDataJson}</script>`}{/if}
</svelte:head>

<CollectionPage
  layout="detail"
  density="detail"
  title={primary || displayName}
  belowTitle={course ? courseCode : undefined}
>
  {#snippet lead()}
    {#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} />{/if}
  {/snippet}
  {#snippet titleExtra()}
    {#if data.locale === "en-us" && secondary && secondary !== primary}{" "}<span class="text-[0.85em] font-normal text-muted-foreground" data-slot="entity-secondary-name">({secondary})</span>{/if}
  {/snippet}
  {@render children()}
</CollectionPage>
