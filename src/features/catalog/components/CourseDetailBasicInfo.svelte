<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import * as Card from "$lib/components/ui/card/index.js";
import type {
  CatalogDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CatalogDetailCopy;
export let course: CourseDetailCourse;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{copy.course.basicInfo}</Card.Title>
    <Card.Description>{copy.courseDetail.basicInfoDescription}</Card.Description>
  </Card.Header>
  <Card.Content>
    <dl class="grid gap-3 text-sm">
      <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
        <dt class="text-base-content/60 text-xs">{copy.course.code}</dt>
        <dd class="mt-1 font-mono font-medium">{course.code}</dd>
      </div>
      {#if course.educationLevel}
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <dt class="text-base-content/60 text-xs">{copy.course.level}</dt>
          <dd class="mt-1 font-medium">{primaryName(course.educationLevel)}</dd>
        </div>
      {/if}
      {#if course.category}
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <dt class="text-base-content/60 text-xs">{copy.course.category}</dt>
          <dd class="mt-1 font-medium">{primaryName(course.category)}</dd>
        </div>
      {/if}
      {#if course.classType}
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <dt class="text-base-content/60 text-xs">{copy.courseDetail.classType}</dt>
          <dd class="mt-1 font-medium">{primaryName(course.classType)}</dd>
        </div>
      {/if}
      {#if course.type}
        <div class="rounded-md border border-base-300 bg-base-200/40 p-3">
          <dt class="text-base-content/60 text-xs">{copy.courseDetail.courseType}</dt>
          <dd class="mt-1 font-medium">{primaryName(course.type)}</dd>
        </div>
      {/if}
    </dl>
  </Card.Content>
</Card.Root>
