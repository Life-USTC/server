<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
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

<Card.Root>
  <Card.Header>
    <Card.Title>{sectionCopy.teachers}</Card.Title>
    <Card.Description>{sectionCopy.teachersDescription}</Card.Description>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-2">
      {#each teachers as teacher}
        <Button class="justify-start" href={`/teachers/${teacher.id}`} variant="outline">
          {teacherName(teacher)}
          {#if teacher.department}
            <Badge class="ml-auto" variant="ghost">{primaryName(teacher.department)}</Badge>
          {/if}
        </Button>
      {:else}
        <p class="text-base-content/60">{sectionCopy.noTeachersListed}</p>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
