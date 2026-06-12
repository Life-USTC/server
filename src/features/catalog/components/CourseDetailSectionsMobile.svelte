<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Badge } from "$lib/components/ui/badge/index.js";
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

<div class="grid gap-3 md:hidden">
  {#each course.sections as section}
    <a class="rounded-md border border-base-300 border-l-4 border-l-[#0969da] bg-base-100 p-4 no-underline transition hover:border-primary/40 hover:bg-base-200/40" href={`/sections/${section.jwId}`}>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-medium">{section.semester?.nameCn ?? notAvailable}</div>
          <div class="mt-1 break-words text-base-content/60 text-sm">{teacherNames(section.teachers) || notAvailable}</div>
        </div>
        <Badge class="shrink-0 font-mono" variant="outline">{section.code}</Badge>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div class="text-base-content/60 text-xs">{copy.courseDetail.campus}</div>
          <div class="mt-1 font-medium">{primaryName(section.campus) || notAvailable}</div>
        </div>
        <div>
          <div class="text-base-content/60 text-xs">{copy.courseDetail.capacity}</div>
          <div class="mt-1 font-medium">{section.stdCount ?? 0} / {section.limitCount ?? notAvailable}</div>
        </div>
      </div>
    </a>
  {:else}
    <div class="rounded-md border border-dashed border-base-300 p-8 text-center text-base-content/60">{copy.courseDetail.noSections}</div>
  {/each}
</div>
