<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import Table from "#lib/components/ui/table/table.svelte";
import {
  catalogLocalizedNames,
  catalogPrimaryName as primaryName,
  sectionSummary,
} from "@/features/catalog/lib/catalog-list-display";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type {
  CourseDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";
import SectionCardIdentity from "./SectionCardIdentity.svelte";

export let copy: CourseDetailCopy;
export let course: CourseDetailCourse;
export let locale: string;
export let notAvailable: string;
</script>

<section class="grid gap-4">
  {#if course.sections.length === 0}
    <div class="min-w-0">
      <CollectionEmpty
        variant="compact"
        title={copy.courseDetail.noSections}
        description={copy.courseDetail.emptySectionsDescription}
      />
    </div>
  {:else}
    <ResponsiveCollection>
      {#snippet mobile()}
        <Item.Group class="min-w-0">
          {#each course.sections as section}
            <MobileListCard variant="outline" href={`/catalog/sections/${section.jwId}`}>
              <SectionCardIdentity {course} teachers={section.teachers} code={section.code} semester={section.semester} {locale} />
              <Item.Footer class="flex-wrap justify-start">
                <span>{copy.courseDetail.campus}: {primaryName(section.campus) || notAvailable}</span>
                <span>{copy.courseDetail.capacity}: {section.stdCount ?? 0} / {section.limitCount ?? notAvailable}</span>
              </Item.Footer>
            </MobileListCard>
          {/each}
        </Item.Group>
      {/snippet}
      {#snippet desktop()}
        <div class="min-w-0">
          <Table>
            <thead>
              <tr>
                <th class="pl-8">{copy.courseDetail.teachingSections}</th>
                <th>{copy.courseDetail.sectionCode}</th>
                <th>{copy.courseDetail.campus}</th>
                <th>{copy.courseDetail.capacity}</th>
                <th>{copy.courseDetail.teachers}</th>
              </tr>
            </thead>
            <tbody>
              {#each course.sections as section}
                {@const sectionHref = `/catalog/sections/${section.jwId}`}
                <tr>
                  <td class="p-0">
                    <CatalogTableLink class="font-medium" href={sectionHref}>
                      {sectionSummary({ ...section, course }, locale)}
                    </CatalogTableLink>
                  </td>
                  <td><TruncatedCode text={section.code} /></td>
                  <td>{primaryName(section.campus) || notAvailable}</td>
                  <td>{section.stdCount ?? 0} / {section.limitCount ?? notAvailable}</td>
                  <td><TruncatedText
                        text={catalogLocalizedNames(section.teachers, locale) || notAvailable}
                      /></td>
                </tr>
              {/each}
            </tbody>
          </Table>
        </div>
      {/snippet}
    </ResponsiveCollection>
  {/if}
</section>
