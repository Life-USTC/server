<script lang="ts">
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import TruncatedCode from "#lib/components/TruncatedCode.svelte";
import * as Table from "#lib/components/ui/table/index.js";
import { catalogPrimaryName } from "@/features/catalog/lib/catalog-list-display";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import CatalogTableLink from "./CatalogTableLink.svelte";
import type {
  TeacherDetailCopy,
  TeacherDetailTeacher,
} from "./catalog-detail-component-types";

export let copy: TeacherDetailCopy;
export let locale: string;
export let notAvailable: string;
export let teacher: TeacherDetailTeacher;
</script>

<div class="min-w-0">
  {#if teacher.sections.length === 0}
    <CollectionEmpty variant="compact" description={copy.teacherDetail.noSections} />
  {:else}
    <Table.Root class="">
      <Table.Header>
        <Table.Row>
          <Table.Head>{copy.teacherDetail.semester}</Table.Head>
          <Table.Head>{copy.teacherDetail.sectionCode}</Table.Head>
          <Table.Head>{copy.teacherDetail.credits}</Table.Head>
          <Table.Head class="pl-8">{copy.teacherDetail.courseName}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each teacher.sections as section}
          {@const sectionHref = `/catalog/sections/${section.jwId}`}
          <Table.Row>
            <Table.Cell>{section.semester?.nameCn ? formatSemesterName(locale, section.semester.nameCn) : notAvailable}</Table.Cell>
            <Table.Cell><TruncatedCode text={section.code} /></Table.Cell>
            <Table.Cell>{section.credits ?? notAvailable}</Table.Cell>
            <Table.Cell class="p-0">
              <CatalogTableLink class="font-medium" href={sectionHref}>
                <span class="break-words">{catalogPrimaryName(section.course) || notAvailable}</span>
              </CatalogTableLink>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/if}
</div>
