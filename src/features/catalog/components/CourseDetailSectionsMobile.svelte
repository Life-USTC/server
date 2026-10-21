<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import {
  type CatalogNamed,
  catalogLocalizedNames,
} from "@/features/catalog/lib/catalog-list-display";
import { formatSemesterName } from "@/lib/text/format-semester-name";
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
  <div class="min-w-0">
    <CollectionEmpty variant="compact"
      title={copy.courseDetail.noSections}
      description={copy.courseDetail.emptySectionsDescription}
    />
  </div>
{:else}
  <Item.Group class="min-w-0">
    {#each course.sections as section}
      <MobileListCard variant="outline" size="sm">
        {#snippet child({ props })}
          <a href={`/catalog/sections/${section.jwId}`} {...props}>
            <Item.Content>
              <Item.Title>{section.semester?.nameCn ? formatSemesterName(locale, section.semester.nameCn) : notAvailable}</Item.Title>
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
      </MobileListCard>
    {/each}
  </Item.Group>
{/if}
