<script lang="ts">
import {
  type CatalogNamed,
  catalogLocalizedNames,
} from "@/features/catalog/lib/catalog-list-display";
import TruncatedCode from "$lib/components/TruncatedCode.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";
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

<div class="hidden md:block">
  {#if course.sections.length === 0}
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{copy.courseDetail.noSections}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <Table.Root class="">
      <Table.Header>
        <Table.Row>
          <Table.Head>{copy.courseDetail.semester}</Table.Head>
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
              <CatalogTableLink href={sectionHref} nowrap>
                {section.semester?.nameCn ?? notAvailable}
              </CatalogTableLink>
            </Table.Cell>
            <Table.Cell class="p-0">
              <CatalogTableLink href={sectionHref}>
                <TruncatedCode text={section.code} />
              </CatalogTableLink>
            </Table.Cell>
            <Table.Cell class="p-0">
              <CatalogTableLink href={sectionHref} nowrap>
                {primaryName(section.campus) || notAvailable}
              </CatalogTableLink>
            </Table.Cell>
            <Table.Cell class="p-0">
              <CatalogTableLink href={sectionHref} nowrap numeric>
                {section.stdCount ?? 0} / {section.limitCount ?? notAvailable}
              </CatalogTableLink>
            </Table.Cell>
            <Table.Cell class="p-0">
              <CatalogTableLink href={sectionHref}>
                <TruncatedText
                  text={catalogLocalizedNames(section.teachers, locale) || notAvailable}
                />
              </CatalogTableLink>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/if}
</div>
