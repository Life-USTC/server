<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
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
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head class="pl-8">{copy.courseDetail.teachingSections}</Table.Head>
                <Table.Head>{copy.courseDetail.sectionCode}</Table.Head>
                <Table.Head>{copy.courseDetail.campus}</Table.Head>
                <Table.Head>{copy.courseDetail.capacity}</Table.Head>
                <Table.Head>{copy.courseDetail.teachers}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each course.sections as section}
                {@const sectionHref = `/catalog/sections/${section.jwId}`}
                <Table.Row>
                  <Table.Cell class="p-0">
                    <CatalogTableLink class="font-medium" href={sectionHref}>
                      {sectionSummary({ ...section, course }, locale)}
                    </CatalogTableLink>
                  </Table.Cell>
                  <Table.Cell><TruncatedCode text={section.code} /></Table.Cell>
                  <Table.Cell>{primaryName(section.campus) || notAvailable}</Table.Cell>
                  <Table.Cell>{section.stdCount ?? 0} / {section.limitCount ?? notAvailable}</Table.Cell>
                  <Table.Cell><TruncatedText
                        text={catalogLocalizedNames(section.teachers, locale) || notAvailable}
                      /></Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {/snippet}
    </ResponsiveCollection>
  {/if}
</section>
