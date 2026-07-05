<script lang="ts">
import type { CatalogNamed } from "@/features/catalog/lib/catalog-list-display";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type {
  TeacherDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: TeacherDetailCopy;
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
            <a class="block h-full w-full whitespace-nowrap px-3 py-2 text-base-content no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset" href={sectionHref}>
              {#if section.semester}{section.semester.nameCn}{:else}<span class="text-base-content/40">{notAvailable}</span>{/if}
            </a>
          </Table.Cell>
          <Table.Cell class="min-w-72 p-0 align-top">
            <a class="block h-full w-full px-3 py-2 text-base-content no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset" href={sectionHref}>
              <span class="font-medium">{primaryName(section.course)}</span>
              {#if secondaryName(section.course)}<span class="block text-base-content/60 text-xs">{secondaryName(section.course)}</span>{/if}
            </a>
          </Table.Cell>
          <Table.Cell class="p-0 align-top">
            <a class="block h-full w-full px-3 py-2 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset" href={sectionHref}>
              <Badge class="font-mono" variant="outline">{section.code}</Badge>
            </a>
          </Table.Cell>
          <Table.Cell class="p-0 text-right align-top">
            <a class="block h-full w-full px-3 py-2 text-base-content no-underline tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset" href={sectionHref}>
              {section.credits ?? notAvailable}
            </a>
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row>
          <Table.Cell class="p-0" colspan={4}>
            <Empty.Root class="py-6">
              <Empty.Header>
                <Empty.Title>{copy.teacherDetail.noSections}</Empty.Title>
              </Empty.Header>
            </Empty.Root>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
