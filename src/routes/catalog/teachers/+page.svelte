<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import CatalogColumnFilter from "@/features/catalog/components/CatalogColumnFilter.svelte";
import CatalogFilters from "@/features/catalog/components/CatalogFilters.svelte";
import { catalogColumnFilters } from "@/features/catalog/components/catalog-column-filters";
import TeachersResults from "@/features/catalog/components/TeachersResults.svelte";
import { createCatalogFilterDraft } from "@/features/catalog/lib/catalog-filter-draft.svelte";
import { catalogActiveFilters } from "@/features/catalog/lib/catalog-filter-view";
import {
  type CatalogNamed,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import { catalogListPageHref } from "@/features/catalog/lib/catalog-list-query";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import type { TableFilterField } from "@/lib/table-filters";
import { page } from "$app/state";
import type { PageData } from "./$types";

type Option = CatalogNamed & { id: number | string };
let { data }: { data: PageData } = $props();
const endless = createEndlessList({
  source: () => data,
  select: (value) => ({ items: value.data, ...value.pagination }),
  key: (row) => row.id,
  pageHref: (next) => catalogListPageHref(new URL(page.url.href), next),
});
const formId = "teacher-filters";
const draft = createCatalogFilterDraft(() => data.filters);
const commonLabels = $derived(data.labels.common);
const teacherLabels = $derived(data.labels.teachers);
const options = (items: Option[]) =>
  items.map((item) => ({ value: String(item.id), label: primaryName(item) }));
const showTitleColumn = $derived(
  endless.items.some((teacher) => Boolean(teacher.teacherTitle)),
);
const showEmailColumn = $derived(
  endless.items.some((teacher) => Boolean(teacher.email)),
);
const fields = $derived<Record<string, TableFilterField>>({
  name: { name: "name", label: teacherLabels.name },
  code: { name: "code", label: teacherLabels.code },
  department: {
    name: "departmentId",
    label: teacherLabels.department,
    options: options(data.filterOptions.departments),
  },
  title: {
    name: "teacherTitleId",
    label: teacherLabels.title_label,
    options: options(data.filterOptions.teacherTitles),
  },
  email: { name: "email", label: teacherLabels.email },
  sections: {
    name: "sectionCount",
    label: teacherLabels.sections,
    type: "number",
    min: 0,
    step: 1,
  },
});
const allFilters = $derived(
  catalogColumnFilters(fields, {
    values: draft.values,
    onchange: draft.update,
    labels: commonLabels.tableFilters,
    formId,
  }),
);
const columnFilters = $derived(
  Object.fromEntries(
    Object.entries(allFilters).filter(
      ([key]) =>
        (key !== "title" && key !== "email") ||
        (key === "title" && showTitleColumn) ||
        (key === "email" && showEmailColumn),
    ),
  ),
);
const extraFilters = $derived(
  Object.entries(allFilters).filter(
    ([key]) =>
      (key === "title" && !showTitleColumn) ||
      (key === "email" && !showEmailColumn),
  ),
);
const activeFilters = $derived(
  catalogActiveFilters(
    "/catalog/teachers",
    data.filters,
    [
      { name: "search", label: teacherLabels.searchLabel },
      ...Object.values(fields),
    ],
    commonLabels.tableFilters,
  ),
);
</script>

{#if data.demo}
  <DemoNotice demo={data.demo} locale={data.locale} />
{/if}

{#snippet paginationFooter()}
  <EndlessScroll state={endless} labels={commonLabels.endlessScroll} />
{/snippet}
{#snippet controls()}
  <CatalogFilters {activeFilters} clearHref="/catalog/teachers" clearLabel={commonLabels.clear} filterTitle={teacherLabels.filterTitle} searchLabel={teacherLabels.searchLabel} searchPlaceholder={teacherLabels.searchNameOrCode} values={draft.values} onchange={draft.update} onsubmit={draft.submit} applyLabel={commonLabels.applyFilters} {formId}>
    {#each extraFilters as [key, filter] (key)}<CatalogColumnFilter {...filter} idPrefix={"teacher-extra-" + key} />{/each}
  </CatalogFilters>
{/snippet}
<CollectionPage description={teacherLabels.subtitle} footer={endless.hasMore ? paginationFooter : undefined} title={teacherLabels.title} toolbar={controls}>
  <TeachersResults {commonLabels} {columnFilters} {teacherLabels} teachers={endless.items} />
</CollectionPage>
