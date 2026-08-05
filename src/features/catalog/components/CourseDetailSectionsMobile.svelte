<script lang="ts">
import {
  type CatalogNamed,
  catalogLocalizedNames,
} from "@/features/catalog/lib/catalog-list-display";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import TruncatedCode from "$lib/components/TruncatedCode.svelte";
import * as Item from "$lib/components/ui/item/index.js";
import type {
  CourseDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CourseDetailCopy;
export let course: CourseDetailCourse;
export let locale: string;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
</script>

{#if course.sections.length === 0}
  <div class="md:hidden">
    <SoftEmptyMessage message={copy.courseDetail.noSections} />
  </div>
{:else}
  <Item.Group class="md:hidden">
    {#each course.sections as section}
      <Item.Root variant="outline" size="sm">
        {#snippet child({ props })}
          <a href={`/catalog/sections/${section.jwId}`} {...props}>
            <Item.Content>
              <Item.Title>{section.semester?.nameCn ?? notAvailable}</Item.Title>
              <Item.Description>
                {catalogLocalizedNames(section.teachers, locale) || notAvailable}
              </Item.Description>
            </Item.Content>
            <Item.Actions>
              <TruncatedCode text={section.code} />
            </Item.Actions>
            <Item.Footer class="flex-wrap justify-start">
              <span>{copy.courseDetail.campus}: {primaryName(section.campus) || notAvailable}</span>
              <span>{copy.courseDetail.capacity}: {section.stdCount ?? 0} / {section.limitCount ?? notAvailable}</span>
            </Item.Footer>
          </a>
        {/snippet}
      </Item.Root>
    {/each}
  </Item.Group>
{/if}
