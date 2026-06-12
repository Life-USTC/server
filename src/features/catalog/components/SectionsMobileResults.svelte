<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import type {
  SectionListLabels,
  SectionListRow,
} from "./catalog-section-list-types";

export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let sectionEmptyDescription: () => string;
export let sectionLabels: SectionListLabels;
export let sections: SectionListRow[];
export let teacherNames: (teachers: CatalogNamed[]) => string;
</script>

<div class="grid gap-3 md:hidden">
  {#each sections as section}
    <a
      class="border-base-300 border-b py-3 no-underline transition-colors hover:bg-base-200/30"
      href={`/sections/${section.jwId}`}
    >
      <div class="grid gap-3">
        <div>
          <h2 class="font-semibold text-base">{primaryName(section.course)}</h2>
          {#if secondaryName(section.course)}
            <p class="mt-1 text-base-content/60 text-sm">{secondaryName(section.course)}</p>
          {/if}
          <p class="mt-1 text-base-content/60 text-sm">{teacherNames(section.teachers) || "-"}</p>
        </div>
        <div class="flex flex-wrap gap-1.5 text-sm">
          <Badge class="font-mono" variant="outline">{section.code}</Badge>
          <Badge variant="ghost">{section.semester?.nameCn ?? sectionLabels.noSemester}</Badge>
          <Badge variant="ghost">{sectionLabels.capacity} {section.stdCount ?? 0} / {section.limitCount ?? "-"}</Badge>
          {#if section.campus}<Badge variant="ghost">{primaryName(section.campus)}</Badge>{/if}
          {#if section.credits !== null}
            <Badge variant="ghost">{sectionLabels.creditValue.replace("{count}", String(section.credits))}</Badge>
          {/if}
        </div>
      </div>
    </a>
  {:else}
    <Alert>
      <div class="grid gap-1">
        <p class="font-semibold">{sectionLabels.noSectionsFound}</p>
        <p class="text-base-content/60 text-sm">{sectionEmptyDescription()}</p>
      </div>
    </Alert>
  {/each}
</div>
