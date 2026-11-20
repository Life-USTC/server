<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as Table from "#lib/components/ui/table/index.js";
import {
  type CatalogNamed,
  catalogLocalizedNames,
  sectionSummary,
} from "@/features/catalog/lib/catalog-list-display";
import CatalogTableLink from "./CatalogTableLink.svelte";
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

<div class="min-w-0">
  {#if course.sections.length === 0}
    <CollectionEmpty variant="compact"
      title={copy.courseDetail.noSections}
      description={copy.courseDetail.emptySectionsDescription}
    />
  {:else}
    <Table.Root class="">
      <Table.Header>
        <Table.Row>
          <Table.Head>{copy.courseDetail.teachingSections}</Table.Head>
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
  {/if}
</div>
