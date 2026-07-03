<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  SectionPrimaryName,
  SectionTeacherCopy,
  SectionTeacherName,
  SectionTeacherSummary,
} from "./section-basic-info-types";

export let primaryName: SectionPrimaryName;
export let sectionCopy: SectionTeacherCopy;
export let teacherName: SectionTeacherName;
export let teachers: SectionTeacherSummary[];
</script>

<div class="border-base-300 border-y text-sm">
  {#each teachers as teacher}
    <Button
      class="h-auto min-h-11 w-full justify-start rounded-none border-base-300 border-b px-3 py-2 text-left last:border-b-0"
      href={`/teachers/${teacher.id}`}
      variant="ghost"
    >
      {teacherName(teacher)}
      {#if teacher.department}
        <Badge class="ml-auto shrink-0" variant="secondary">{primaryName(teacher.department)}</Badge>
      {/if}
    </Button>
  {:else}
    <p class="px-3 py-4 text-base-content/60">{sectionCopy.noTeachersListed}</p>
  {/each}
</div>
