<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import {
  catalogActiveFilters,
  catalogFilterDraft,
} from "@/features/catalog/lib/catalog-filter-view";
import {
  type CatalogNamed,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import type { TableFilterField } from "@/lib/table-filters";
import CatalogColumnFilter from "./CatalogColumnFilter.svelte";
import CatalogFilters from "./CatalogFilters.svelte";
import type { CatalogColumnFilterProps } from "./catalog-column-filter-types";
import type {
  TeacherListCommonLabels,
  TeacherListFilters,
  TeacherListLabels,
  TeacherListRow,
} from "./catalog-teacher-list-types";
import TeachersResults from "./TeachersResults.svelte";

type Option = CatalogNamed & { id: number | string };
type PageData = {
  data: TeacherListRow[];
  filterOptions: { departments: Option[]; teacherTitles: Option[] };
  filters: TeacherListFilters;
  labels: {
    common: TeacherListCommonLabels;
    teachers: TeacherListLabels & { title: string };
  };
  locale: string;
  pagination: { page: number; total: number; totalPages: number };
};
let { data, endless }: { data: PageData; endless: EndlessScrollState } =
  $props();
const formId = "teacher-filters";
const appliedFilters = $derived(data.filters);
let draft = $derived(catalogFilterDraft(appliedFilters));
const commonLabels = $derived(data.labels.common);
const teacherLabels = $derived(data.labels.teachers);
function update(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
const options = (items: Option[]) =>
  items.map((item) => ({ value: String(item.id), label: primaryName(item) }));
const showTitleColumn = $derived(
  data.data.some((teacher) => Boolean(teacher.teacherTitle)),
);
const showEmailColumn = $derived(
  data.data.some((teacher) => Boolean(teacher.email)),
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
const allFilters = $derived<Record<string, CatalogColumnFilterProps>>(
  Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [
      key,
      {
        label: field.label,
        fields: [field],
        values: draft,
        onchange: update,
        labels: commonLabels.tableFilters,
        formId,
      },
    ]),
  ),
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

{#snippet paginationFooter()}
  <EndlessScroll state={endless} labels={commonLabels.endlessScroll} />
{/snippet}
{#snippet controls()}
  <CatalogFilters {activeFilters} clearHref="/catalog/teachers" clearLabel={commonLabels.clear} filterTitle={teacherLabels.filterTitle} searchLabel={teacherLabels.searchLabel} searchPlaceholder={teacherLabels.searchNameOrCode} values={draft} onchange={update} applyLabel={commonLabels.applyFilters} {formId}>
    {#each extraFilters as [key, filter] (key)}<CatalogColumnFilter {...filter} idPrefix={"teacher-extra-" + key} />{/each}
  </CatalogFilters>
{/snippet}
<CollectionPage description={teacherLabels.subtitle} footer={endless.hasMore ? paginationFooter : undefined} title={teacherLabels.title} toolbar={controls}>
  <TeachersResults {commonLabels} {columnFilters} primaryName={primaryName} {teacherLabels} teachers={data.data} />
</CollectionPage>
