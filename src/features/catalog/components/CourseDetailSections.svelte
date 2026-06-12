<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import CourseDetailSectionsMobile from "./CourseDetailSectionsMobile.svelte";
import CourseDetailSectionsTable from "./CourseDetailSectionsTable.svelte";
import type {
  CatalogDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CatalogDetailCopy;
export let course: CourseDetailCourse;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let teacherNames: (teachers: CatalogNamed[]) => string;
</script>

<section class="grid gap-4">
  <CourseDetailSectionsMobile
    {copy}
    {course}
    {notAvailable}
    {primaryName}
    {teacherNames}
  />
  <CourseDetailSectionsTable
    {copy}
    {course}
    {notAvailable}
    {primaryName}
    {teacherNames}
  />
</section>
