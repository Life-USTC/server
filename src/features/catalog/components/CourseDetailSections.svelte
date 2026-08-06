<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import CourseDetailSectionsMobile from "./CourseDetailSectionsMobile.svelte";
import CourseDetailSectionsTable from "./CourseDetailSectionsTable.svelte";
import type {
  CourseDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CourseDetailCopy;
export let course: CourseDetailCourse;
export let locale: string;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
</script>

<section class="grid gap-4">
  <CourseDetailSectionsMobile
    {copy}
    {course}
    {locale}
    {notAvailable}
    {primaryName}
  />
  <CourseDetailSectionsTable
    {copy}
    {course}
    {locale}
    {notAvailable}
    {primaryName}
  />
</section>
