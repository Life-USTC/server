<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import type {
  TeacherListCommonLabels,
  TeacherListLabels,
  TeacherListRow,
} from "./catalog-teacher-list-types";

export let commonLabels: TeacherListCommonLabels;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let showSecondaryNames: boolean;
export let teacherLabels: TeacherListLabels;
export let teachers: TeacherListRow[];
</script>

<div class="grid gap-3 md:hidden">
  {#each teachers as teacher}
    <a
      class="grid w-full gap-3 border-base-300 border-b py-3 no-underline transition-colors hover:bg-base-200/30"
      href={`/teachers/${teacher.id}`}
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="truncate font-semibold text-lg">{primaryName(teacher)}</h2>
          {#if showSecondaryNames && secondaryName(teacher)}
            <p class="truncate text-base-content/60 text-sm">({secondaryName(teacher)})</p>
          {/if}
          {#if teacher.email}<p class="mt-1 break-words text-base-content/60 text-xs">{teacher.email}</p>{/if}
        </div>
        <Badge class="shrink-0" variant="outline">{teacher._count.sections}</Badge>
      </div>
      <div class="flex flex-wrap gap-1.5 text-sm">
        {#if teacher.code}<Badge class="font-mono" variant="outline">{teacher.code}</Badge>{/if}
        <Badge variant="ghost">{teacher.department ? primaryName(teacher.department) : teacherLabels.noDepartment}</Badge>
        <Badge variant="ghost">{teacher.teacherTitle ? primaryName(teacher.teacherTitle) : commonLabels.unknown}</Badge>
        <Badge variant="ghost">{teacherLabels.sections} {teacher._count.sections}</Badge>
      </div>
    </a>
  {:else}
    <Alert>{teacherLabels.noTeachersFound}</Alert>
  {/each}
</div>
