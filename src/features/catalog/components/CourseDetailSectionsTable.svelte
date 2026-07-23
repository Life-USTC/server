<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import CatalogTableLink from "./CatalogTableLink.svelte";
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

<div class="hidden md:block">
  <Table.Root class="table-fixed">
    <Table.Header>
      <Table.Row>
        <Table.Head class="w-32">{copy.courseDetail.semester}</Table.Head>
        <Table.Head class="w-28">{copy.courseDetail.sectionCode}</Table.Head>
        <Table.Head>{copy.courseDetail.teachers}</Table.Head>
        <Table.Head class="w-20 text-right">{copy.courseDetail.campus}</Table.Head>
        <Table.Head class="w-24 text-right">{copy.courseDetail.capacity}</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each course.sections as section}
        {@const sectionHref = `/catalog/sections/${section.jwId}`}
        <Table.Row>
          <Table.Cell class="p-0 align-top">
            <CatalogTableLink href={sectionHref} nowrap>
              <TruncatedText text={section.semester?.nameCn ?? notAvailable} />
            </CatalogTableLink>
          </Table.Cell>
          <Table.Cell class="p-0 align-top">
            <CatalogTableLink href={sectionHref}>
              <Badge variant="outline">{section.code}</Badge>
            </CatalogTableLink>
          </Table.Cell>
          <Table.Cell class="p-0 align-top">
            <CatalogTableLink href={sectionHref}>
              <TruncatedText
                text={teacherNames(section.teachers) || notAvailable}
              />
            </CatalogTableLink>
          </Table.Cell>
          <Table.Cell class="p-0 text-right align-top">
            <CatalogTableLink href={sectionHref} nowrap>
              <TruncatedText
                text={primaryName(section.campus) || notAvailable}
              />
            </CatalogTableLink>
          </Table.Cell>
          <Table.Cell class="p-0 text-right align-top">
            <CatalogTableLink href={sectionHref} nowrap numeric>
              {section.stdCount ?? 0} / {section.limitCount ?? notAvailable}
            </CatalogTableLink>
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row>
          <Table.Cell class="p-0" colspan={5}>
            <Empty.Root class="py-6">
              <Empty.Header>
                <Empty.Title>{copy.courseDetail.noSections}</Empty.Title>
              </Empty.Header>
            </Empty.Root>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
