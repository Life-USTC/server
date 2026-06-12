<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type {
  CatalogDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";
import TeacherDetailSectionsMobile from "./TeacherDetailSectionsMobile.svelte";
import TeacherDetailSectionsTable from "./TeacherDetailSectionsTable.svelte";

export let copy: CatalogDetailCopy;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let teacher: TeacherDetailTeacher;
</script>

<section class="grid gap-4">
  <TeacherDetailSectionsMobile
    {copy}
    {notAvailable}
    {primaryName}
    {secondaryName}
    {teacher}
  />
  <TeacherDetailSectionsTable
    {copy}
    {notAvailable}
    {primaryName}
    {secondaryName}
    {teacher}
  />
</section>
