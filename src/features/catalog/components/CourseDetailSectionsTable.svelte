<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type {
  CatalogDetailCopy,
  CourseDetailCourse,
} from "./catalog-detail-component-types";

export let copy: CatalogDetailCopy;
export let course: CourseDetailCourse;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let teacherNames: (teachers: CatalogNamed[]) => string;
</script>

<div class="hidden md:block">
  <Table.Root>
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
        {@const sectionHref = `/sections/${section.jwId}`}
        <Table.Row>
          <Table.Cell class="p-0 align-top">
            <Table.CellLink class="whitespace-nowrap px-3 py-2 text-base-content" href={sectionHref}>
              {section.semester?.nameCn ?? notAvailable}
            </Table.CellLink>
          </Table.Cell>
          <Table.Cell class="p-0 align-top">
            <Table.CellLink class="px-3 py-2" href={sectionHref}>
              <Badge class="font-mono" variant="outline">{section.code}</Badge>
            </Table.CellLink>
          </Table.Cell>
          <Table.Cell class="p-0 align-top">
            <Table.CellLink class="px-3 py-2 text-base-content" href={sectionHref}>
              {teacherNames(section.teachers) || notAvailable}
            </Table.CellLink>
          </Table.Cell>
          <Table.Cell class="p-0 text-right align-top">
            <Table.CellLink class="whitespace-nowrap px-3 py-2 text-base-content" href={sectionHref}>
              {primaryName(section.campus) || notAvailable}
            </Table.CellLink>
          </Table.Cell>
          <Table.Cell class="p-0 text-right align-top">
            <Table.CellLink class="whitespace-nowrap px-3 py-2 text-base-content tabular-nums" href={sectionHref}>
              {section.stdCount ?? 0} / {section.limitCount ?? notAvailable}
            </Table.CellLink>
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row><Table.Cell colspan={5}>{copy.courseDetail.noSections}</Table.Cell></Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
