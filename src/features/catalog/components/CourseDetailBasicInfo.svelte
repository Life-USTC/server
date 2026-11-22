<script lang="ts">
import BookIcon from "@lucide/svelte/icons/book-open";
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "#lib/components/detail-definition-list.js";
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import type {
  CourseDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CourseDetailCopy;
export let course: CourseDetailCourse;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
</script>

<dl class={detailDefinitionListClass} data-testid="course-detail-aside-facts">
  {#if course.classType}
    <dt class={detailDefinitionTermClass}><BookIcon aria-hidden="true" class="me-1 inline size-4 shrink-0 align-[-0.125em]" />{copy.courseDetail.classType}</dt>
    <dd class="m-0 min-w-0 font-medium">{primaryName(course.classType)}</dd>
  {/if}

  {#if course.type}
    <dt class={detailDefinitionTermClass}><BookIcon aria-hidden="true" class="me-1 inline size-4 shrink-0 align-[-0.125em]" />{copy.courseDetail.courseType}</dt>
    <dd class="m-0 min-w-0 font-medium">{primaryName(course.type)}</dd>
  {/if}
</dl>
