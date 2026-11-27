<script lang="ts">
import BookIcon from "@lucide/svelte/icons/book-open";
import {
  detailDefinitionListClass,
  detailDefinitionTermClass,
} from "#lib/components/detail-definition-list.js";
import {
  type CatalogNamed,
  catalogPrimaryName as primaryName,
} from "@/features/catalog/lib/catalog-list-display";
import type {
  CourseDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CourseDetailCopy;
export let course: CourseDetailCourse;
</script>

{#snippet fact(label: string, item: CatalogNamed | null | undefined, showBook = false)}
  {#if item}
    <dt class={detailDefinitionTermClass}>
      {#if showBook}<BookIcon aria-hidden="true" class="me-1 inline size-4 shrink-0 align-[-0.125em]" />{/if}{label}
    </dt>
    <dd class="m-0 min-w-0 font-medium">{primaryName(item)}</dd>
  {/if}
{/snippet}

<div data-detail-identity>
  <dl class={detailDefinitionListClass} data-testid="course-detail-facts">
    {@render fact(copy.course.level, course.educationLevel)}
    {@render fact(copy.course.category, course.category)}
  </dl>
</div>
<dl class={detailDefinitionListClass} data-testid="course-detail-aside-facts">
  {@render fact(copy.courseDetail.classType, course.classType, true)}
  {@render fact(copy.courseDetail.courseType, course.type, true)}
</dl>
