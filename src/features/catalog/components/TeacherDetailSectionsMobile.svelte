<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Badge } from "$lib/components/ui/badge/index.js";
import type {
  CatalogDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: CatalogDetailCopy;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let teacher: TeacherDetailTeacher;
</script>

<div class="grid gap-3 md:hidden">
  {#each teacher.sections as section}
    <a class="rounded-md border border-base-300 border-l-4 border-l-[#0969da] bg-base-100 p-4 no-underline transition hover:border-primary/40 hover:bg-base-200/40" href={`/sections/${section.jwId}`}>
      <div class="grid gap-3">
        <div>
          <h3 class="font-semibold">{primaryName(section.course)}</h3>
          {#if secondaryName(section.course)}<p class="mt-1 text-base-content/60 text-sm">{secondaryName(section.course)}</p>{/if}
        </div>
        <div class="flex flex-wrap gap-1.5 text-sm">
          <Badge class="font-mono" variant="outline">{section.code}</Badge>
          <Badge variant="ghost">{section.semester?.nameCn ?? notAvailable}</Badge>
          <Badge variant="ghost">{section.credits ?? notAvailable} {copy.teacherDetail.credits}</Badge>
        </div>
      </div>
    </a>
  {:else}
    <div class="rounded-md border border-dashed border-base-300 p-8 text-center text-base-content/60">{copy.teacherDetail.noSections}</div>
  {/each}
</div>
