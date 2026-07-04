<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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

<Item.Group>
  {#each teachers as teacher}
    <Item.Root size="sm">
      {#snippet child({ props })}
        <a href={`/teachers/${teacher.id}`} {...props}>
          <Item.Content>
            <Item.Title>{teacherName(teacher)}</Item.Title>
          </Item.Content>
          {#if teacher.department}
            <Item.Actions>
              <Badge variant="secondary">{primaryName(teacher.department)}</Badge>
            </Item.Actions>
          {/if}
        </a>
      {/snippet}
    </Item.Root>
  {:else}
    <Empty.Root class="min-h-20 border border-border bg-background p-4">
      <Empty.Header>
        <Empty.Description>{sectionCopy.noTeachersListed}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/each}
</Item.Group>
