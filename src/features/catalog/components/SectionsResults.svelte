<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type {
  SectionListLabels,
  SectionListResultData,
  SectionListSemester,
} from "./catalog-section-list-types";
import SectionsMobileResults from "./SectionsMobileResults.svelte";
import SectionsTableResults from "./SectionsTableResults.svelte";

export let data: SectionListResultData;
export let page: number;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let sectionEmptyDescription: () => string;
export let sectionLabels: SectionListLabels;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let selectedSemester: SectionListSemester | null | undefined;
export let teacherNames: (teachers: CatalogNamed[]) => string;
export let totalPages: number;
</script>

<SectionsMobileResults
  sections={data.data}
  {primaryName}
  {secondaryName}
  {sectionEmptyDescription}
  {sectionLabels}
  {teacherNames}
/>

<SectionsTableResults
  filters={data.filters}
  pagination={data.pagination}
  {page}
  {primaryName}
  {secondaryName}
  sections={data.data}
  {sectionEmptyDescription}
  {sectionLabels}
  {selectedSemester}
  {teacherNames}
  {totalPages}
/>
