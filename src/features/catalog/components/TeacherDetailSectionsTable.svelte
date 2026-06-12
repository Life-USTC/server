<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type {
  CatalogDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: CatalogDetailCopy;
export let notAvailable: string;
export let primaryName: (item: CatalogNamed | null | undefined) => string;
export let secondaryName: (item: CatalogNamed | null | undefined) => string;
export let teacher: TeacherDetailTeacher;
</script>

<div class="hidden md:block">
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head class="w-32">{copy.teacherDetail.semester}</Table.Head>
        <Table.Head>{copy.teacherDetail.courseName}</Table.Head>
        <Table.Head class="w-28">{copy.teacherDetail.sectionCode}</Table.Head>
        <Table.Head class="w-16 text-right">{copy.teacherDetail.credits}</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each teacher.sections as section}
        {@const sectionHref = `/sections/${section.jwId}`}
        <Table.Row>
          <Table.Cell class="p-0 align-top">
            <Table.CellLink class="whitespace-nowrap px-3 py-2 text-base-content" href={sectionHref}>
              {#if section.semester}{section.semester.nameCn}{:else}<span class="text-base-content/40">{notAvailable}</span>{/if}
            </Table.CellLink>
          </Table.Cell>
          <Table.Cell class="min-w-72 p-0 align-top">
            <Table.CellLink class="px-3 py-2 text-base-content" href={sectionHref}>
              <span class="font-medium">{primaryName(section.course)}</span>
              {#if secondaryName(section.course)}<span class="block text-base-content/60 text-xs">{secondaryName(section.course)}</span>{/if}
            </Table.CellLink>
          </Table.Cell>
          <Table.Cell class="p-0 align-top">
            <Table.CellLink class="px-3 py-2" href={sectionHref}>
              <Badge class="font-mono" variant="outline">{section.code}</Badge>
            </Table.CellLink>
          </Table.Cell>
          <Table.Cell class="p-0 text-right align-top">
            <Table.CellLink class="px-3 py-2 text-base-content tabular-nums" href={sectionHref}>
              {section.credits ?? notAvailable}
            </Table.CellLink>
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row><Table.Cell colspan={4}>{copy.teacherDetail.noSections}</Table.Cell></Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
