<script lang="ts">
import * as Accordion from "$lib/components/ui/accordion/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  SectionBasicInfo,
  SectionBasicInfoCopy,
  SectionTeachersLabel,
} from "./section-basic-info-types";

export let notAvailable: string;
export let section: SectionBasicInfo;
export let sectionCopy: SectionBasicInfoCopy;
export let sectionTeachersLabel: SectionTeachersLabel;
</script>

{#if section.sameSemesterOtherTeachers.length > 0 || section.sameTeacherOtherSemesters.length > 0}
  <Accordion.Item title={sectionCopy.otherSections}>
    <div class="grid gap-4">
      {#if section.sameSemesterOtherTeachers.length > 0}
        <div class="grid gap-2">
          <p class="text-base-content/60 text-sm">{sectionCopy.sameSemesterOtherTeachers}</p>
          <div class="flex flex-wrap gap-2">
            {#each section.sameSemesterOtherTeachers.slice(0, 10) as related}
              <Button class="h-auto min-h-8 whitespace-normal px-2 py-1 text-left" href={`/sections/${related.jwId}`} variant="outline">
                <span>{sectionTeachersLabel(related)}</span>
                <Badge class="ml-1 font-mono" variant="ghost">{related.code}</Badge>
              </Button>
            {/each}
          </div>
        </div>
      {/if}
      {#if section.sameTeacherOtherSemesters.length > 0}
        <div class="grid gap-2">
          <p class="text-base-content/60 text-sm">{sectionCopy.sameTeacherOtherSemesters}</p>
          <div class="flex flex-wrap gap-2">
            {#each section.sameTeacherOtherSemesters.slice(0, 10) as related}
              <Button class="h-auto min-h-8 whitespace-normal px-2 py-1 text-left" href={`/sections/${related.jwId}`} variant="outline">
                <span>{related.semester?.nameCn ?? notAvailable}</span>
                <Badge class="ml-1 font-mono" variant="ghost">{related.code}</Badge>
              </Button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </Accordion.Item>
{/if}
