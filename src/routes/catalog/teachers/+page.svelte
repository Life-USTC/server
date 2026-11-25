<script lang="ts">
import CatalogColumnFilter from "@/features/catalog/components/CatalogColumnFilter.svelte";
import CatalogListPage from "@/features/catalog/components/CatalogListPage.svelte";
import { catalogColumnFilters } from "@/features/catalog/components/catalog-column-filters";
import TeachersResults from "@/features/catalog/components/TeachersResults.svelte";
import { catalogActiveFilters } from "@/features/catalog/lib/catalog-filter-view";
import {
  type CatalogNamed,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import { createCatalogList } from "@/features/catalog/lib/create-catalog-list";
import type { TableFilterField } from "@/lib/table-filters";
import type { PageData } from "./$types";

type Option = CatalogNamed & { id: number | string };
let { data }: { data: PageData } = $props();
const { endless, draft } = createCatalogList(
  () => data,
  (row) => row.id,
);
const formId = "teacher-filters";
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
const hiddenColumnFilters = $derived(
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

<CatalogListPage
  title={teacherLabels.title} description={teacherLabels.subtitle}
  demo={data.demo} locale={data.locale}
  {endless} {commonLabels} {activeFilters}
  clearHref="/catalog/teachers" filterTitle={teacherLabels.filterTitle}
  searchLabel={teacherLabels.searchLabel} searchPlaceholder={teacherLabels.searchNameOrCode}
  {draft} {formId}
>
  {#snippet extraFilters()}
    {#each hiddenColumnFilters as [key, filter] (key)}<CatalogColumnFilter {...filter} idPrefix={"teacher-extra-" + key} />{/each}
  {/snippet}
  <TeachersResults {commonLabels} {columnFilters} {teacherLabels} teachers={endless.items} />
</CatalogListPage>
