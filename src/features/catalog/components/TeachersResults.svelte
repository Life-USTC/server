<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type {
  TeacherListCommonLabels,
  TeacherListFilters,
  TeacherListLabels,
  TeacherListRow,
} from "./catalog-teacher-list-types";
import TeachersMobileResults from "./TeachersMobileResults.svelte";
import TeachersTableResults from "./TeachersTableResults.svelte";

export let commonLabels: TeacherListCommonLabels;
export let filters: TeacherListFilters;
export let page: number;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let selectedDepartment: CatalogNamed | null | undefined;
export let showSecondaryNames: boolean;
export let teacherLabels: TeacherListLabels;
export let teachers: TeacherListRow[];
export let total: number;
export let totalPages: number;
</script>

<TeachersMobileResults
  {commonLabels}
  {primaryName}
  {secondaryName}
  {showSecondaryNames}
  {teacherLabels}
  {teachers}
/>

<TeachersTableResults
  {commonLabels}
  {filters}
  {page}
  {primaryName}
  {secondaryName}
  {selectedDepartment}
  {showSecondaryNames}
  {teacherLabels}
  {teachers}
  {total}
  {totalPages}
/>
