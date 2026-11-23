<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import SearchFilterBar from "#lib/components/SearchFilterBar.svelte";
import { catalogActiveFilters } from "@/features/catalog/lib/catalog-filter-view";
import {
  type CatalogNamed,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import type { TableFilterField } from "@/lib/table-filters";
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
const commonLabels = $derived(data.labels.common);
const teacherLabels = $derived(data.labels.teachers);
const options = (items: Option[]) =>
  items.map((item) => ({ value: String(item.id), label: primaryName(item) }));
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
  <SearchFilterBar
    action="/catalog/teachers"
    filters={data.filters}
    fields={Object.values(fields)}
    active={activeFilters}
    groupLabel={teacherLabels.filterTitle}
    searchLabel={commonLabels.search}
    placeholder={teacherLabels.searchNameOrCode}
    clearLabel={commonLabels.clear}
    applyLabel={commonLabels.applyFilters}
    filterLabels={commonLabels.tableFilters}
    noResults={commonLabels.noMatchingOptions}
  />
{/snippet}
<CollectionPage description={teacherLabels.subtitle} footer={endless.hasMore ? paginationFooter : undefined} title={teacherLabels.title} toolbar={controls}>
  <TeachersResults {commonLabels} filtered={activeFilters.length > 0} clearLabel={commonLabels.clear} primaryName={primaryName} {teacherLabels} teachers={data.data} />
</CollectionPage>
