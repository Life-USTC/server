<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  CourseDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CourseDetailCopy;
export let course: CourseDetailCourse;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let teacherNames: (teachers: CatalogNamed[]) => string;
</script>

<Item.Group class="md:hidden">
  {#each course.sections as section}
    <Item.Root variant="outline" size="sm">
      {#snippet child({ props })}
        <a href={`/catalog/sections/${section.jwId}`} {...props}>
          <Item.Content>
            <Item.Title>{section.semester?.nameCn ?? notAvailable}</Item.Title>
            <Item.Description>
              {teacherNames(section.teachers) || notAvailable}
            </Item.Description>
          </Item.Content>
          <Item.Actions>
            <Badge variant="outline">{section.code}</Badge>
          </Item.Actions>
          <Item.Footer class="flex-wrap justify-start">
            <span>{copy.courseDetail.campus}: {primaryName(section.campus) || notAvailable}</span>
            <span>{copy.courseDetail.capacity}: {section.stdCount ?? 0} / {section.limitCount ?? notAvailable}</span>
          </Item.Footer>
        </a>
      {/snippet}
    </Item.Root>
  {:else}
    <Empty.Root>
      <Empty.Header>
        <Empty.Title>{copy.courseDetail.noSections}</Empty.Title>
      </Empty.Header>
    </Empty.Root>
  {/each}
</Item.Group>
