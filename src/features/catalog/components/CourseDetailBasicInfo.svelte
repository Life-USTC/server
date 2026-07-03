<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type {
  CourseDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CourseDetailCopy;
export let course: CourseDetailCourse;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
</script>

<dl class="grid border-base-300 border-y text-sm sm:grid-cols-2 xl:grid-cols-3">
  <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
    <dt class="text-base-content/60 text-xs">{copy.course.code}</dt>
    <dd class="mt-1 font-mono font-medium">{course.code}</dd>
  </div>
  {#if course.educationLevel}
    <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
      <dt class="text-base-content/60 text-xs">{copy.course.level}</dt>
      <dd class="mt-1 font-medium">{primaryName(course.educationLevel)}</dd>
    </div>
  {/if}
  {#if course.category}
    <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
      <dt class="text-base-content/60 text-xs">{copy.course.category}</dt>
      <dd class="mt-1 font-medium">{primaryName(course.category)}</dd>
    </div>
  {/if}
  {#if course.classType}
    <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
      <dt class="text-base-content/60 text-xs">{copy.courseDetail.classType}</dt>
      <dd class="mt-1 font-medium">{primaryName(course.classType)}</dd>
    </div>
  {/if}
  {#if course.type}
    <div class="border-base-300 border-b px-4 py-3 sm:min-h-20 sm:border-r">
      <dt class="text-base-content/60 text-xs">{copy.courseDetail.courseType}</dt>
      <dd class="mt-1 font-medium">{primaryName(course.type)}</dd>
    </div>
  {/if}
</dl>
