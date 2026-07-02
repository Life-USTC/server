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

<dl class="divide-y divide-base-300 border-base-300 border-y text-sm">
  <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
    <dt class="text-base-content/60 text-xs">{copy.course.code}</dt>
    <dd class="font-mono font-medium">{course.code}</dd>
  </div>
  {#if course.educationLevel}
    <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
      <dt class="text-base-content/60 text-xs">{copy.course.level}</dt>
      <dd class="font-medium">{primaryName(course.educationLevel)}</dd>
    </div>
  {/if}
  {#if course.category}
    <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
      <dt class="text-base-content/60 text-xs">{copy.course.category}</dt>
      <dd class="font-medium">{primaryName(course.category)}</dd>
    </div>
  {/if}
  {#if course.classType}
    <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
      <dt class="text-base-content/60 text-xs">{copy.courseDetail.classType}</dt>
      <dd class="font-medium">{primaryName(course.classType)}</dd>
    </div>
  {/if}
  {#if course.type}
    <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline">
      <dt class="text-base-content/60 text-xs">{copy.courseDetail.courseType}</dt>
      <dd class="font-medium">{primaryName(course.type)}</dd>
    </div>
  {/if}
</dl>
