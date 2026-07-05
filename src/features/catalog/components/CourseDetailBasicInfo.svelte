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

<dl class="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
  <div class="min-w-0 py-1.5 sm:min-h-14">
    <dt class="text-muted-foreground text-xs">{copy.course.code}</dt>
    <dd class="mt-1 font-mono font-medium">{course.code}</dd>
  </div>
  {#if course.educationLevel}
    <div class="min-w-0 py-1.5 sm:min-h-14">
      <dt class="text-muted-foreground text-xs">{copy.course.level}</dt>
      <dd class="mt-1 font-medium">{primaryName(course.educationLevel)}</dd>
    </div>
  {/if}
  {#if course.category}
    <div class="min-w-0 py-1.5 sm:min-h-14">
      <dt class="text-muted-foreground text-xs">{copy.course.category}</dt>
      <dd class="mt-1 font-medium">{primaryName(course.category)}</dd>
    </div>
  {/if}
  {#if course.classType}
    <div class="min-w-0 py-1.5 sm:min-h-14">
      <dt class="text-muted-foreground text-xs">{copy.courseDetail.classType}</dt>
      <dd class="mt-1 font-medium">{primaryName(course.classType)}</dd>
    </div>
  {/if}
  {#if course.type}
    <div class="min-w-0 py-1.5 sm:min-h-14">
      <dt class="text-muted-foreground text-xs">{copy.courseDetail.courseType}</dt>
      <dd class="mt-1 font-medium">{primaryName(course.type)}</dd>
    </div>
  {/if}
</dl>
