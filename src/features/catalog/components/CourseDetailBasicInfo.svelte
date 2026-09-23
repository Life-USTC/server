<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "$lib/components/detail-definition-list";
import type {
  CourseDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CourseDetailCopy;
export let course: CourseDetailCourse;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
</script>

<dl class={detailDefinitionListClass}>
  <dt class={detailDefinitionTermClass}>{copy.course.code}</dt>
  <dd class="m-0 font-mono text-muted-foreground">{course.code}</dd>

  {#if course.educationLevel}
    <dt class={detailDefinitionTermClass}>{copy.course.level}</dt>
    <dd class="m-0 min-w-0 font-medium">{primaryName(course.educationLevel)}</dd>
  {/if}

  {#if course.category}
    <dt class={detailDefinitionTermClass}>{copy.course.category}</dt>
    <dd class="m-0 min-w-0 font-medium">{primaryName(course.category)}</dd>
  {/if}

  {#if course.classType}
    <dt class={detailDefinitionTermClass}>{copy.courseDetail.classType}</dt>
    <dd class="m-0 min-w-0 font-medium">{primaryName(course.classType)}</dd>
  {/if}

  {#if course.type}
    <dt class={detailDefinitionTermClass}>{copy.courseDetail.courseType}</dt>
    <dd class="m-0 min-w-0 font-medium">{primaryName(course.type)}</dd>
  {/if}
</dl>
