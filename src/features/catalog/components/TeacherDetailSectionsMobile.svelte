<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  TeacherDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: TeacherDetailCopy;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let teacher: TeacherDetailTeacher;
</script>

<Item.Group class="md:hidden">
  {#each teacher.sections as section}
    <Item.Root variant="outline" size="sm">
      {#snippet child({ props })}
        <a href={`/sections/${section.jwId}`} {...props}>
          <Item.Content>
            <Item.Title>{primaryName(section.course)}</Item.Title>
            {#if secondaryName(section.course)}
              <Item.Description>{secondaryName(section.course)}</Item.Description>
            {/if}
          </Item.Content>
          <Item.Actions>
            <Badge class="font-mono" variant="outline">{section.code}</Badge>
          </Item.Actions>
          <Item.Footer class="flex-wrap justify-start text-muted-foreground text-xs">
            <span>{section.semester?.nameCn ?? notAvailable}</span>
            <span>{section.credits ?? notAvailable} {copy.teacherDetail.credits}</span>
          </Item.Footer>
        </a>
      {/snippet}
    </Item.Root>
  {:else}
    <Empty.Root class="border">
      <Empty.Header>
        <Empty.Title>{copy.teacherDetail.noSections}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {/each}
</Item.Group>
